// submit-lead: public "contact us" endpoint for the marketing landing.
// - No auth (verify_jwt=false): anyone can file a sales enquiry.
// - Honeypot + length validation + per-email 24h rate limit guard against spam.
// - Stored via the service role in public.leads (the table is otherwise private).
// - If RESEND_API_KEY is set, also emails the team (LEADS_TO, default
//   contact@aframat.com). Email failures never fail the request — the lead is
//   already saved and visible in the admin portal.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANGS = ["fr", "ar", "en"];

function clean(v: unknown, max: number): string {
  return (typeof v === "string" ? v : "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method_not_allowed", "POST only", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }

  // Honeypot: a hidden field real users never fill. Bots do → pretend success.
  if (clean(body.company_website, 200)) return jsonResponse({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const business_name = clean(body.business_name, 160);
  const phone = clean(body.phone, 40);
  const city = clean(body.city, 120);
  const message = clean(body.message, 2000);
  const locale = LANGS.includes(clean(body.locale, 2)) ? clean(body.locale, 2) : "fr";

  if (name.length < 2) return errorResponse("bad_name", "Name is required");
  if (!EMAIL_RE.test(email)) return errorResponse("bad_email", "A valid email is required");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Rate limit: max 5 enquiries per email / 24h. Over the cap → pretend success
  // (don't reveal the limit, don't store more).
  const { data: recent } = await admin.rpc("recent_lead_count", { p_email: email });
  if ((recent ?? 0) >= 5) return jsonResponse({ ok: true });

  const { error: insErr } = await admin
    .from("leads")
    .insert({ name, email, business_name, phone, city, message, locale, source: "landing" });
  if (insErr) {
    console.error("submit-lead insert failed:", insErr);
    return errorResponse("db_error", "Could not submit your request", 500);
  }

  // Optional email notification (best-effort).
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const to = Deno.env.get("LEADS_TO") ?? "contact@aframat.com";
    const from = Deno.env.get("LEADS_FROM") ?? "Chehia <leads@aframat.com>";
    const text =
      `New Chehia enquiry\n\n` +
      `Name: ${name}\nBusiness: ${business_name || "—"}\nEmail: ${email}\n` +
      `Phone: ${phone || "—"}\nCity: ${city || "—"}\nLanguage: ${locale}\n\n${message || "(no message)"}`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, reply_to: email, subject: `New lead — ${business_name || name}`, text }),
      });
      if (!r.ok) console.error("submit-lead resend failed:", r.status, await r.text());
    } catch (e) {
      console.error("submit-lead resend error:", e);
    }
  }

  return jsonResponse({ ok: true });
});
