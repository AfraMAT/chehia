// inventory-alerts: the nightly low-stock digest.
//   1. Refreshes each venue's in-portal alert state (idempotent — raises a
//      notification only for items that newly crossed their threshold).
//   2. Emails owners/managers a digest of what's low or out, IF a
//      RESEND_API_KEY is configured and the venue kept email alerts on.
//
// In-portal alerts are the always-on channel and need no external service or
// even this job (they fire the instant stock is depleted). This function is the
// "reach them when they're not looking at the portal" reminder.
//
// Auth: callable by cron (x-cron-secret) or with the service role key — same
// shape as generate-insights.
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, jsonResponse } from "../_shared/cors.ts";

type LowItem = {
  id: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  reorder_threshold: number;
  par_level: number | null;
  level: "low" | "out";
  supplier_name: string;
};

const LANGS = ["fr", "ar", "en"];

function digest(venue: string, low: LowItem[], lang: string): { subject: string; text: string } {
  const outCount = low.filter((i) => i.level === "out").length;
  const lowCount = low.length - outCount;
  const line = (i: LowItem) => {
    const qty = `${i.qty_on_hand} ${i.unit}`;
    const buy = i.par_level != null && i.par_level > i.qty_on_hand ? Math.round((i.par_level - i.qty_on_hand) * 1000) / 1000 : null;
    if (lang === "ar") {
      const tag = i.level === "out" ? "نفد" : "منخفض";
      return `• ${i.name} — ${tag} (${qty})` + (buy ? ` — للطلب: ${buy} ${i.unit}` : "") + (i.supplier_name ? ` — ${i.supplier_name}` : "");
    }
    if (lang === "en") {
      const tag = i.level === "out" ? "OUT" : "low";
      return `• ${i.name} — ${tag} (${qty})` + (buy ? ` — order ${buy} ${i.unit}` : "") + (i.supplier_name ? ` — ${i.supplier_name}` : "");
    }
    const tag = i.level === "out" ? "RUPTURE" : "bas";
    return `• ${i.name} — ${tag} (${qty})` + (buy ? ` — à commander : ${buy} ${i.unit}` : "") + (i.supplier_name ? ` — ${i.supplier_name}` : "");
  };
  const body = low.map(line).join("\n");
  if (lang === "ar") {
    return {
      subject: `المخزون: ${outCount} نفد · ${lowCount} منخفض — ${venue}`,
      text: `مرحباً،\n\nحالة المخزون في ${venue}:\n\n${body}\n\nافتح بوابة شهية لإعادة التموين.\n— شهية`,
    };
  }
  if (lang === "en") {
    return {
      subject: `Stock: ${outCount} out · ${lowCount} low — ${venue}`,
      text: `Hello,\n\nStock status at ${venue}:\n\n${body}\n\nOpen the Chehia portal to restock.\n— Chehia`,
    };
  }
  return {
    subject: `Stock : ${outCount} en rupture · ${lowCount} bas — ${venue}`,
    text: `Bonjour,\n\nÉtat du stock chez ${venue} :\n\n${body}\n\nOuvrez le portail Chehia pour réapprovisionner.\n— Chehia`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse("method_not_allowed", "POST only", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("INVENTORY_CRON_SECRET") ?? Deno.env.get("INSIGHTS_CRON_SECRET");

  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const providedSecret = req.headers.get("x-cron-secret");
  const authorized = (cronSecret && providedSecret === cronSecret) || bearer === serviceKey;
  if (!authorized) return errorResponse("unauthorized", "Cron secret or service role required", 401);

  const admin = createClient(supabaseUrl, serviceKey);

  let restaurantFilter: string | null = null;
  try {
    const body = await req.json();
    restaurantFilter = body?.restaurant_id ?? null;
  } catch {
    // no body: process every active venue
  }

  let query = admin
    .from("restaurants")
    .select("id, name, default_language, inventory_alerts_enabled")
    .eq("is_active", true);
  if (restaurantFilter) query = query.eq("id", restaurantFilter);
  const { data: restaurants, error } = await query;
  if (error) return errorResponse("db_error", error.message, 500);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("INVENTORY_FROM") ?? Deno.env.get("LEADS_FROM") ?? "Chehia <alerts@aframat.com>";
  const results: Record<string, { new_alerts: number; low: number; emailed: number }> = {};

  for (const r of restaurants ?? []) {
    // 1) Refresh in-portal alerts (raises only newly-crossed items).
    const { data: created, error: syncErr } = await admin.rpc("sync_stock_alerts", { p_restaurant_id: r.id });
    if (syncErr) console.error(`sync_stock_alerts failed for ${r.id}:`, syncErr);

    // 2) Current low/out list.
    const { data: lowData } = await admin.rpc("low_stock_items", { p_restaurant_id: r.id });
    const low = (lowData as LowItem[] | null) ?? [];

    // 3) Optional email digest (best-effort; never affects the in-portal alerts).
    let emailed = 0;
    if (resendKey && r.inventory_alerts_enabled !== false && low.length > 0) {
      const { data: recips } = await admin.rpc("venue_alert_recipients", { p_restaurant_id: r.id });
      const to = ((recips as { email: string }[] | null) ?? []).map((x) => x.email).filter(Boolean);
      if (to.length > 0) {
        const lang = LANGS.includes(r.default_language) ? r.default_language : "fr";
        const { subject, text } = digest(r.name, low, lang);
        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to, subject, text }),
          });
          if (resp.ok) emailed = to.length;
          else console.error("inventory-alerts resend failed:", resp.status, await resp.text());
        } catch (e) {
          console.error("inventory-alerts resend error:", e);
        }
      }
    }

    results[r.id] = { new_alerts: (created as number) ?? 0, low: low.length, emailed };
  }

  return jsonResponse({ processed: results, email: Boolean(resendKey) });
});
