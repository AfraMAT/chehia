// admin-provision-business: a platform admin creates a new venue and its
// owner account in one atomic-ish step. Only callers listed in
// public.platform_admins may invoke it. The new venue starts inactive
// (is_active=false, onboarding_completed_at=null); the owner activates it
// by finishing the onboarding wizard.
import {
  callerId,
  EMAIL_RE,
  generatePassword,
  serviceClient,
  SLUG_RE,
  slugify,
} from "../_shared/admin.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

const LANGS = ["fr", "ar", "en"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method_not_allowed", "POST only", 405);

  const uid = await callerId(req);
  if (!uid) return errorResponse("unauthorized", "Sign in first", 401);

  const admin = serviceClient();

  // Gate: caller must be a platform admin.
  const { data: pa } = await admin
    .from("platform_admins")
    .select("id")
    .eq("auth_uid", uid)
    .maybeSingle();
  if (!pa) return errorResponse("forbidden", "Platform admin only", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }

  const restaurant = (body.restaurant ?? {}) as Record<string, unknown>;
  const owner = (body.owner ?? {}) as Record<string, unknown>;

  const name = String(restaurant.name ?? "").trim();
  let slug = String(restaurant.slug ?? "").trim().toLowerCase();
  const city = String(restaurant.city ?? "").trim();
  const address = String(restaurant.address ?? "").trim();
  const phone = String(restaurant.phone ?? "").trim();
  const plan = restaurant.plan === "pro" ? "pro" : "starter";
  const languages = Array.isArray(restaurant.languages)
    ? (restaurant.languages as string[]).filter((l) => (LANGS as readonly string[]).includes(l))
    : [...LANGS];
  const defaultLanguage = (LANGS as readonly string[]).includes(String(restaurant.default_language))
    ? String(restaurant.default_language)
    : (languages[0] ?? "fr");

  const ownerEmail = String(owner.email ?? "").trim().toLowerCase();
  const ownerName = String(owner.display_name ?? "").trim();
  let password = String(owner.password ?? "");

  if (!name) return errorResponse("bad_request", "Venue name is required");
  if (!slug) slug = slugify(name);
  if (!SLUG_RE.test(slug)) return errorResponse("bad_slug", "Slug must be lowercase letters, numbers and dashes");
  if (!EMAIL_RE.test(ownerEmail)) return errorResponse("bad_email", "A valid owner email is required");
  if (!ownerName) return errorResponse("bad_request", "Owner name is required");
  if (!password) password = generatePassword();
  if (password.length < 8) return errorResponse("weak_password", "Password must be at least 8 characters");
  if (languages.length === 0) return errorResponse("bad_request", "At least one language is required");

  // Slug uniqueness (also enforced by a DB unique constraint).
  const { data: existing } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return errorResponse("slug_taken", "That slug is already in use", 409);

  // 1) Restaurant (inactive until onboarding completes).
  const { data: resto, error: rErr } = await admin
    .from("restaurants")
    .insert({
      slug,
      name,
      city,
      address,
      phone,
      plan,
      languages,
      default_language: defaultLanguage,
      is_active: false,
    })
    .select("id, slug, name")
    .single();
  if (rErr || !resto) {
    if (rErr?.code === "23505") return errorResponse("slug_taken", "That slug is already in use", 409);
    console.error("provision restaurant insert failed:", rErr);
    return errorResponse("db_error", "Could not create the venue", 500);
  }

  // 2) Owner auth user.
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: ownerName },
  });
  if (cErr || !created.user) {
    await admin.from("restaurants").delete().eq("id", resto.id); // roll back
    const dup = (cErr?.message ?? "").toLowerCase().includes("already");
    return errorResponse(
      dup ? "email_taken" : "user_create_failed",
      dup ? "A user with that email already exists" : (cErr?.message ?? "Could not create the owner account"),
      dup ? 409 : 500,
    );
  }

  // 3) Owner staff row.
  const { error: sErr } = await admin.from("staff").insert({
    restaurant_id: resto.id,
    auth_uid: created.user.id,
    role: "owner",
    display_name: ownerName,
  });
  if (sErr) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back both
    await admin.from("restaurants").delete().eq("id", resto.id);
    console.error("provision staff insert failed:", sErr);
    return errorResponse("db_error", "Could not link the owner to the venue", 500);
  }

  return jsonResponse({
    restaurant: { id: resto.id, slug: resto.slug, name: resto.name },
    owner: { email: ownerEmail, display_name: ownerName, password, user_id: created.user.id },
  });
});
