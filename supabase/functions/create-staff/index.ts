// create-staff: an owner or manager adds a team member (manager, waiter or
// kitchen) to their own venue. Creates the auth user + staff row server-side
// (the browser client cannot create auth users). The new member is scoped to
// the caller's restaurant; managers may only create waiter/kitchen.
import { callerId, EMAIL_RE, generatePassword, serviceClient } from "../_shared/admin.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

const ASSIGNABLE = ["manager", "waiter", "kitchen"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method_not_allowed", "POST only", 405);

  const uid = await callerId(req);
  if (!uid) return errorResponse("unauthorized", "Sign in first", 401);

  const admin = serviceClient();

  // Caller must be an active owner/manager of some venue.
  const { data: me } = await admin
    .from("staff")
    .select("restaurant_id, role")
    .eq("auth_uid", uid)
    .eq("is_active", true)
    .maybeSingle();
  if (!me || (me.role !== "owner" && me.role !== "manager")) {
    return errorResponse("forbidden", "Only an owner or manager can add staff", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const displayName = String(body.display_name ?? "").trim();
  const role = String(body.role ?? "");
  let password = String(body.password ?? "");

  if (!EMAIL_RE.test(email)) return errorResponse("bad_email", "A valid email is required");
  if (!displayName) return errorResponse("bad_request", "Display name is required");
  if (!(ASSIGNABLE as readonly string[]).includes(role)) {
    return errorResponse("bad_role", "Role must be manager, waiter or kitchen");
  }
  // A manager cannot mint another manager — only owners can.
  if (me.role === "manager" && role === "manager") {
    return errorResponse("forbidden", "Only the owner can add a manager", 403);
  }
  if (!password) password = generatePassword();
  if (password.length < 8) return errorResponse("weak_password", "Password must be at least 8 characters");

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Starter password relayed by the owner/manager; the member chooses their
    // own on first login (the portal clears this flag then).
    user_metadata: { display_name: displayName, must_change_password: true },
  });
  if (cErr || !created.user) {
    const dup = (cErr?.message ?? "").toLowerCase().includes("already");
    return errorResponse(
      dup ? "email_taken" : "user_create_failed",
      dup ? "A user with that email already exists" : (cErr?.message ?? "Could not create the account"),
      dup ? 409 : 500,
    );
  }

  const { data: staff, error: sErr } = await admin
    .from("staff")
    .insert({
      restaurant_id: me.restaurant_id,
      auth_uid: created.user.id,
      role,
      display_name: displayName,
    })
    .select("id")
    .single();
  if (sErr || !staff) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back
    console.error("create-staff staff insert failed:", sErr);
    return errorResponse("db_error", "Could not create the staff member", 500);
  }

  return jsonResponse({
    staff: { id: staff.id, role, display_name: displayName },
    account: { email, password, user_id: created.user.id },
  });
});
