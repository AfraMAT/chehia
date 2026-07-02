"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  currencyLabel,
  formatCount,
  millimesToDisplay,
  type AiInsight,
  type I18nText,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { ZelligeMark } from "@/components/brand";
import { usePortal } from "../portal-provider";

type Range = "today" | "week" | "month";

/**
 * Aggregates come from the stats_summary SQL function: computed in Postgres
 * under RLS (no PostgREST row-cap truncation) with hour buckets in the
 * venue's timezone, and "today" meaning the calendar day there.
 */
interface Summary {
  revenue_millimes: number;
  prev_revenue_millimes: number;
  order_count: number;
  prev_order_count: number;
  median_service_minutes: number | null;
  hourly: { hour: number; n: number }[];
  top_items: { name: I18nText; qty: number; revenue_millimes: number }[];
}

/** W5 · Analytics — SQL charts (deterministic) + nightly AI insight cards. */
export default function StatsPage() {
  const { restaurant } = usePortal();
  const { t, tr, lang } = useI18n();
  const supabase = getSupabase();

  const [range, setRange] = useState<Range>("week");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const days = range === "today" ? 1 : range === "week" ? 7 : 30;

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: rpc }, { data: ai }] = await Promise.all([
      supabase.rpc("stats_summary", { p_restaurant_id: restaurant.id, p_days: days }),
      supabase
        .from("ai_insights")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("language", lang)
        .order("generated_for", { ascending: false })
        .limit(3)
        .overrideTypes<AiInsight[], { merge: false }>(),
    ]);
    setSummary((rpc as Summary | null) ?? null);
    setInsights(ai ?? []);
    setLoading(false);
  }, [restaurant.id, supabase, days, lang]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => {
    const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
    const revenue = summary?.revenue_millimes ?? 0;
    const prevRevenue = summary?.prev_revenue_millimes ?? 0;
    const count = summary?.order_count ?? 0;
    const prevCount = summary?.prev_order_count ?? 0;
    const avgBasket = count ? Math.round(revenue / count) : 0;
    const prevAvg = prevCount ? Math.round(prevRevenue / prevCount) : 0;
    return {
      revenue,
      revenueDelta: pct(revenue, prevRevenue),
      count,
      countDelta: pct(count, prevCount),
      avgBasket,
      avgDelta: pct(avgBasket, prevAvg),
      medianService: summary?.median_service_minutes != null ? Math.round(summary.median_service_minutes) : null,
    };
  }, [summary]);

  const hourly = useMemo(() => {
    const byHour = new Map((summary?.hourly ?? []).map((h) => [h.hour, h.n]));
    // 7h→23h baseline; extend earlier only when early-morning data exists.
    const earliest = Math.min(7, ...[...byHour.keys()].filter((h) => byHour.get(h)! > 0));
    const hours = Array.from({ length: 24 - earliest }, (_, i) => i + earliest);
    const max = Math.max(1, ...hours.map((h) => byHour.get(h) ?? 0));
    const peak = hours.reduce((best, h) => ((byHour.get(h) ?? 0) > (byHour.get(best) ?? 0) ? h : best), hours[0] ?? 7);
    return hours.map((h) => ({
      hour: h,
      count: byHour.get(h) ?? 0,
      pct: Math.round(((byHour.get(h) ?? 0) / max) * 100),
      isPeak: h === peak && (byHour.get(h) ?? 0) > 0,
    }));
  }, [summary]);

  const topItems = useMemo(() => {
    const list = summary?.top_items ?? [];
    const max = Math.max(1, ...list.map((i) => i.qty));
    return list.map((i) => ({
      name: tr(i.name) || "?",
      qty: i.qty,
      revenue: i.revenue_millimes,
      pct: Math.round((i.qty / max) * 100),
    }));
  }, [summary, tr]);

  const hasData = (summary?.order_count ?? 0) > 0;

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header + range switch */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-3">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.portal.stats.title}</h1>
        <div className="flex-1" />
        <div className="flex bg-card border border-line rounded-md p-[3px] gap-0.5">
          {(
            [
              { key: "today", label: t.portal.stats.today },
              { key: "week", label: t.portal.stats.week },
              { key: "month", label: t.portal.stats.month },
            ] as { key: Range; label: string }[]
          ).map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-3.5 py-[7px] rounded-sm text-[12.5px] cursor-pointer transition-colors ${
                range === r.key ? "bg-ink text-cream font-extrabold" : "text-muted font-bold hover:bg-sand"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 px-6">
        <KpiCard
          label={t.portal.stats.sales}
          value={formatCount(Math.round(stats.revenue / 1000))}
          unit={currencyLabel(lang)}
          delta={stats.revenueDelta}
          deltaSuffix={t.portal.stats.vsLastWeek}
        />
        <KpiCard label={t.portal.stats.orders} value={String(stats.count)} delta={stats.countDelta} />
        <KpiCard
          label={t.portal.stats.avgBasket}
          value={millimesToDisplay(stats.avgBasket, lang)}
          unit={currencyLabel(lang)}
          delta={stats.avgDelta}
        />
        <KpiCard
          label={t.portal.stats.medianService}
          value={stats.medianService !== null ? String(stats.medianService) : "—"}
          unit={t.common.min}
        />
      </div>

      {!hasData && !loading && (
        <div className="mx-6 mt-4 bg-card border border-line rounded-2xl p-8 flex flex-col items-center gap-2 text-center">
          <span className="font-display font-extrabold text-xl text-ink">{t.portal.stats.noData}</span>
          <span className="text-sm text-muted">{t.portal.stats.noDataBody}</span>
        </div>
      )}

      {hasData && (
        <div className="flex gap-3 px-6 pt-3 flex-col xl:flex-row">
          {/* Peak hours */}
          <div className="flex-[1.35] bg-card border border-line rounded-xl p-4.5 flex flex-col gap-3 p-4">
            <div className="flex justify-between items-baseline">
              <span className="font-extrabold text-sm text-ink">{t.portal.stats.peakHours}</span>
              <span className="text-[11.5px] font-bold text-muted-soft">{t.portal.stats.peakHoursSub}</span>
            </div>
            <div className="flex items-end gap-1.5 h-[118px]" dir="ltr">
              {hourly.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className={`w-full rounded-t-[5px] rounded-b-sm ${h.isPeak ? "bg-harissa" : "bg-[#E8D9C8]"}`}
                    style={{ height: `${Math.max(h.pct, h.count > 0 ? 6 : 2)}%` }}
                    title={`${h.count}`}
                  />
                  <span className={`text-[9.5px] font-bold ${h.isPeak ? "text-harissa-pressed" : "text-muted-soft"}`}>
                    {h.hour}h
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top items */}
          <div className="flex-1 bg-card border border-line rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline">
              <span className="font-extrabold text-sm text-ink">{t.portal.stats.topItems}</span>
              <span className="text-[11.5px] font-bold text-muted-soft">
                {range === "today" ? t.portal.stats.today : range === "week" ? t.portal.stats.week : t.portal.stats.month}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {topItems.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2.5">
                  <span className="w-4 text-[11px] font-extrabold text-muted-soft">{index + 1}</span>
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="text-[12.5px] font-extrabold text-ink truncate">{item.name}</span>
                      <span className="text-[11.5px] font-bold text-muted-soft whitespace-nowrap" dir="ltr">
                        {item.qty} {t.portal.stats.sales2} · {formatCount(Math.round(item.revenue / 1000))} {currencyLabel(lang)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded bg-sand-deep overflow-hidden">
                      <div className="h-full rounded bg-teal" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chehia Intelligence */}
      <div className="mx-6 my-4 bg-teal-pressed rounded-2xl p-4.5 flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <ZelligeMark size={26} color="#FAF6EF" inner="#0B4A52" radius={8} />
          <span className="font-display font-extrabold text-base text-cream">{t.portal.stats.intelligence}</span>
          <span className="text-[11px] font-extrabold text-cream/65 bg-white/10 rounded-full px-2.5 py-1">
            {t.portal.stats.generatedNightly}
          </span>
        </div>
        {insights.length === 0 ? (
          <div className="bg-card rounded-lg px-4 py-5 text-center">
            <span className="text-[13px] font-semibold text-muted">{t.portal.stats.noInsights}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((insight) => (
              <div key={insight.id} className="bg-card rounded-lg p-4 flex flex-col gap-2">
                <span className="font-extrabold text-[13.5px] text-ink leading-snug">{insight.title}</span>
                <span className="text-xs leading-relaxed text-muted flex-1">{insight.body}</span>
                <span className="text-xs font-extrabold text-teal-pressed leading-snug">{insight.recommendation}</span>
                {insight.action_label && (
                  <span className="self-start text-xs font-extrabold text-teal-pressed border-[1.5px] border-teal-pressed rounded-full px-3.5 py-1.5">
                    {insight.action_label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaSuffix,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  deltaSuffix?: string;
}) {
  return (
    <div className="bg-card border border-line rounded-xl px-4 py-3.5 flex flex-col gap-0.5">
      <span className="text-[11.5px] font-extrabold text-muted-soft tracking-wide">{label}</span>
      <span className="font-display font-extrabold text-[27px] text-ink leading-tight" dir="ltr">
        {value} {unit && <span className="font-sans font-bold text-[13px] text-muted-soft">{unit}</span>}
      </span>
      {typeof delta === "number" && (
        <span className={`text-xs font-extrabold ${delta >= 0 ? "text-success-text" : "text-danger-text"}`} dir="ltr">
          {delta >= 0 ? "▲ +" : "▼ "}
          {delta}%{deltaSuffix ? ` ${deltaSuffix}` : ""}
        </span>
      )}
    </div>
  );
}
