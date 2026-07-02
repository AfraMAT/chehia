// generate-insights: the nightly "Chehia Intelligence" job.
// SQL does the analytics (cheap, deterministic); the LLM only writes the
// "what should I do" narrative from a compact metrics summary.
//
// Auth: callable by cron (x-cron-secret) or with the service role key.
// Without ANTHROPIC_API_KEY the function falls back to deterministic,
// template-based insights so the whole pipeline works locally.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { errorResponse, jsonResponse } from "../_shared/cors.ts";

// The playbook pins the insights narrative to a cheap-model class;
// override with INSIGHTS_MODEL (e.g. claude-opus-4-8) for higher quality.
const MODEL = Deno.env.get("INSIGHTS_MODEL") ?? "claude-haiku-4-5";

type Metrics = {
  restaurant_name: string;
  period_days: number;
  total_orders: number;
  total_revenue_tnd: number;
  avg_basket_tnd: number;
  median_service_minutes: number | null;
  orders_by_hour: { hour: number; orders: number }[];
  orders_by_weekday: { weekday: string; orders: number }[];
  top_items: { name: string; qty: number; revenue_tnd: number }[];
  unavailable_items: string[];
};

/**
 * Metrics come from the insights_metrics SQL function: aggregation happens in
 * Postgres (no PostgREST row-cap truncation) with hour buckets computed in
 * the venue's own timezone.
 */
async function computeMetrics(admin: SupabaseClient, restaurantId: string, name: string): Promise<Metrics> {
  const { data, error } = await admin.rpc("insights_metrics", {
    p_restaurant_id: restaurantId,
    p_days: 7,
  });
  if (error || !data) {
    console.error("insights_metrics failed:", error);
    throw new Error("metrics unavailable");
  }
  const raw = data as {
    total_orders: number;
    total_revenue_millimes: number;
    median_service_minutes: number | null;
    orders_by_hour: { hour: number; orders: number }[];
    orders_by_weekday: { weekday: string; orders: number }[];
    top_items: { name: string; qty: number; revenue_millimes: number }[];
    unavailable_items: string[];
  };
  const toTnd = (millimes: number) => Math.round(millimes / 100) / 10;
  return {
    restaurant_name: name,
    period_days: 7,
    total_orders: raw.total_orders,
    total_revenue_tnd: toTnd(raw.total_revenue_millimes),
    avg_basket_tnd: raw.total_orders ? toTnd(raw.total_revenue_millimes / raw.total_orders) : 0,
    median_service_minutes:
      raw.median_service_minutes === null ? null : Math.round(raw.median_service_minutes),
    orders_by_hour: raw.orders_by_hour,
    orders_by_weekday: raw.orders_by_weekday,
    top_items: raw.top_items.map((t) => ({ name: t.name, qty: t.qty, revenue_tnd: toTnd(t.revenue_millimes) })),
    unavailable_items: raw.unavailable_items,
  };
}

type InsightCard = {
  title: string;
  body: string;
  recommendation: string;
  action_label: string;
};

const LANGUAGE_NAMES: Record<string, string> = {
  fr: "French",
  ar: "Tunisian-friendly Modern Standard Arabic",
  en: "English",
};

async function llmInsights(metrics: Metrics, language: string): Promise<InsightCard[]> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system:
      "You are Chehia Intelligence, an analyst for Tunisian cafés and restaurants. " +
      "You write short, actionable business insights from order metrics. " +
      "Each insight must end in one concrete, quantified action the owner can take this week. " +
      "Currency is TND. Be specific with numbers from the data; never invent data that is not in the metrics.",
    messages: [
      {
        role: "user",
        content:
          `Metrics for the last ${metrics.period_days} days (JSON):\n` +
          JSON.stringify(metrics) +
          `\n\nWrite exactly 3 insight cards in ${LANGUAGE_NAMES[language] ?? "French"}.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["insights"],
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "body", "recommendation", "action_label"],
                properties: {
                  title: { type: "string", description: "Punchy headline, max 8 words" },
                  body: { type: "string", description: "2 sentences grounded in the metrics" },
                  recommendation: { type: "string", description: "One concrete quantified action" },
                  action_label: { type: "string", description: "Button label, max 3 words" },
                },
              },
            },
          },
        },
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const parsed = JSON.parse(textBlock && "text" in textBlock ? textBlock.text : "{}");
  return (parsed.insights ?? []).slice(0, 3);
}

// Deterministic fallback used when no ANTHROPIC_API_KEY is configured (local dev).
function templateInsights(metrics: Metrics, language: string): InsightCard[] {
  const top = metrics.top_items[0];
  const peak = [...metrics.orders_by_hour].sort((a, b) => b.orders - a.orders)[0];
  const t = {
    fr: {
      c1: {
        title: top ? `${top.name} porte vos ventes` : "Pas encore assez de données",
        body: top
          ? `${top.name} : ${top.qty} ventes et ${top.revenue_tnd} TND sur 7 jours — votre article n°1.`
          : "Enregistrez quelques jours de commandes pour recevoir des recommandations.",
        recommendation: top
          ? `Proposer une formule autour de « ${top.name} » pour augmenter le panier moyen (${metrics.avg_basket_tnd} TND)`
          : "Continuez à prendre des commandes via Chehia",
        action_label: "Créer la promotion",
      },
      c2: {
        title: peak ? `Votre pic est à ${peak.hour}h` : "Rythme de la semaine",
        body: peak
          ? `${peak.orders} commandes autour de ${peak.hour}h cette semaine. Total : ${metrics.total_orders} commandes, ${metrics.total_revenue_tnd} TND.`
          : `Total : ${metrics.total_orders} commandes sur 7 jours.`,
        recommendation: "Renforcer l'équipe 1h avant le pic pour tenir le temps de service",
        action_label: "Planifier",
      },
      c3: {
        title: metrics.unavailable_items.length
          ? `${metrics.unavailable_items[0]} est épuisé`
          : "Aucune rupture cette semaine",
        body: metrics.unavailable_items.length
          ? `${metrics.unavailable_items.join(", ")} marqué(s) épuisé(s) — chaque jour de rupture est du chiffre perdu.`
          : "Tous vos articles sont restés disponibles — bonne gestion des stocks.",
        recommendation: metrics.unavailable_items.length
          ? "Augmenter la préparation du matin d'environ 30%"
          : "Maintenir le niveau de préparation actuel",
        action_label: "Noté, à suivre",
      },
    },
    ar: {
      c1: {
        title: top ? `${top.name} يقود مبيعاتك` : "لا توجد بيانات كافية بعد",
        body: top
          ? `${top.name}: ${top.qty} مبيعات و ${top.revenue_tnd} د.ت في 7 أيام — المنتج الأول لديك.`
          : "سجّل بضعة أيام من الطلبات لتلقي التوصيات.",
        recommendation: top ? `اقترح عرضاً حول «${top.name}» لرفع متوسط السلة` : "واصل استقبال الطلبات عبر شهية",
        action_label: "إنشاء العرض",
      },
      c2: {
        title: peak ? `ذروتك على الساعة ${peak.hour}` : "إيقاع الأسبوع",
        body: `المجموع: ${metrics.total_orders} طلب و ${metrics.total_revenue_tnd} د.ت خلال 7 أيام.`,
        recommendation: "عزّز الفريق قبل ساعة من الذروة للحفاظ على سرعة الخدمة",
        action_label: "خطّط",
      },
      c3: {
        title: metrics.unavailable_items.length ? "منتج نفد من المخزون" : "لا نفاد هذا الأسبوع",
        body: metrics.unavailable_items.length
          ? `${metrics.unavailable_items.join("، ")} مسجّل كمنتهٍ — كل يوم نفاد هو مبيعات ضائعة.`
          : "كل المنتجات بقيت متوفرة — إدارة مخزون جيدة.",
        recommendation: metrics.unavailable_items.length ? "زد التحضير الصباحي بنحو 30%" : "حافظ على مستوى التحضير الحالي",
        action_label: "تمّت الملاحظة",
      },
    },
    en: {
      c1: {
        title: top ? `${top.name} drives your sales` : "Not enough data yet",
        body: top
          ? `${top.name}: ${top.qty} sold, ${top.revenue_tnd} TND over 7 days — your #1 item.`
          : "Record a few days of orders to receive recommendations.",
        recommendation: top
          ? `Bundle "${top.name}" into a combo to lift the average basket (${metrics.avg_basket_tnd} TND)`
          : "Keep taking orders through Chehia",
        action_label: "Create promo",
      },
      c2: {
        title: peak ? `Your peak is at ${peak.hour}:00` : "Weekly rhythm",
        body: `Total: ${metrics.total_orders} orders, ${metrics.total_revenue_tnd} TND over 7 days.`,
        recommendation: "Add one staff member an hour before the peak to protect service time",
        action_label: "Plan it",
      },
      c3: {
        title: metrics.unavailable_items.length ? "An item keeps selling out" : "No stockouts this week",
        body: metrics.unavailable_items.length
          ? `${metrics.unavailable_items.join(", ")} marked sold out — every stockout day is lost revenue.`
          : "All items stayed available — good stock management.",
        recommendation: metrics.unavailable_items.length ? "Increase morning prep by ~30%" : "Keep current prep levels",
        action_label: "Noted",
      },
    },
  } as const;
  const lang = (t as Record<string, typeof t.fr>)[language] ?? t.fr;
  return [lang.c1, lang.c2, lang.c3];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("INSIGHTS_CRON_SECRET");

  // Authorize: cron secret header, or the service-role key as bearer.
  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const providedSecret = req.headers.get("x-cron-secret");
  const authorized = (cronSecret && providedSecret === cronSecret) || bearer === serviceKey;
  if (!authorized) {
    return errorResponse("unauthorized", "Cron secret or service role required", 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  let restaurantFilter: string | null = null;
  try {
    const body = await req.json();
    restaurantFilter = body?.restaurant_id ?? null;
  } catch {
    // no body: process all restaurants
  }

  let query = admin.from("restaurants").select("id, name, languages").eq("is_active", true);
  if (restaurantFilter) query = query.eq("id", restaurantFilter);
  const { data: restaurants, error } = await query;
  if (error) return errorResponse("db_error", error.message, 500);

  const useLlm = Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
  const today = new Date().toISOString().slice(0, 10);
  const results: Record<string, number> = {};

  for (const r of restaurants ?? []) {
    let metrics: Metrics;
    try {
      metrics = await computeMetrics(admin, r.id, r.name);
    } catch {
      results[r.id] = -1;
      continue;
    }

    // Build every language's cards first, then swap the day's insights atomically.
    const rows: Record<string, unknown>[] = [];
    for (const lang of (r.languages as string[]) ?? ["fr"]) {
      let cards: InsightCard[];
      try {
        cards = useLlm ? await llmInsights(metrics, lang) : templateInsights(metrics, lang);
      } catch (err) {
        console.error(`LLM failed for ${r.id}/${lang}, using fallback:`, err);
        cards = templateInsights(metrics, lang);
      }
      for (const c of cards) {
        rows.push({
          language: lang,
          title: c.title,
          body: c.body,
          recommendation: c.recommendation,
          action_label: c.action_label,
          metrics: metrics as unknown as Record<string, unknown>,
        });
      }
    }

    const { data: replaced, error: replaceErr } = await admin.rpc("replace_insights", {
      p_restaurant_id: r.id,
      p_generated_for: today,
      p_rows: rows,
    });
    if (replaceErr) {
      console.error("replace_insights failed:", replaceErr);
      results[r.id] = 0;
    } else {
      results[r.id] = (replaced as number) ?? rows.length;
    }
  }

  return jsonResponse({ generated: results, llm: useLlm, model: useLlm ? MODEL : "template" });
});
