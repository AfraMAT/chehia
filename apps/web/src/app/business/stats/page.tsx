"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  currencyLabel,
  formatCount,
  millimesToDisplay,
  type AiInsight,
  type Order,
  type OrderItem,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { ZelligeMark } from "@/components/brand";
import { usePortal } from "../portal-provider";

type Range = "today" | "week" | "month";

/** W5 · Analytics — SQL charts (deterministic) + nightly AI insight cards. */
export default function StatsPage() {
  const { restaurant } = usePortal();
  const { t, tr, lang } = useI18n();
  const supabase = getSupabase();

  const [range, setRange] = useState<Range>("week");
  const [orders, setOrders] = useState<Order[]>([]);
  const [prevOrders, setPrevOrders] = useState<Order[]>([]);
  const [lines, setLines] = useState<OrderItem[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const days = range === "today" ? 1 : range === "week" ? 7 : 30;

  const reload = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const prevSince = new Date(Date.now() - 2 * days * 24 * 3600 * 1000).toISOString();

    const [{ data: current }, { data: previous }, { data: items }, { data: ai }] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .neq("status", "cancelled")
        .gte("created_at", since)
        .overrideTypes<Order[], { merge: false }>(),
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .neq("status", "cancelled")
        .gte("created_at", prevSince)
        .lt("created_at", since)
        .overrideTypes<Order[], { merge: false }>(),
      supabase.from("order_items").select("*").eq("restaurant_id", restaurant.id).overrideTypes<OrderItem[], { merge: false }>(),
      supabase
        .from("ai_insights")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("language", lang)
        .order("generated_for", { ascending: false })
        .limit(3)
        .overrideTypes<AiInsight[], { merge: false }>(),
    ]);

    setOrders(current ?? []);
    setPrevOrders(previous ?? []);
    setLines(items ?? []);
    setInsights(ai ?? []);
    setLoading(false);
  }, [restaurant.id, supabase, days, lang]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.total_millimes, 0);
    const prevRevenue = prevOrders.reduce((s, o) => s + o.total_millimes, 0);
    const avgBasket = orders.length ? Math.round(revenue / orders.length) : 0;
    const prevAvg = prevOrders.length ? Math.round(prevRevenue / prevOrders.length) : 0;

    const served = orders.filter((o) => o.served_at);
    const serviceTimes = served
      .map((o) => (new Date(o.served_at as string).getTime() - new Date(o.created_at).getTime()) / 60000)
      .sort((a, b) => a - b);
    const medianService = serviceTimes.length ? Math.round(serviceTimes[Math.floor(serviceTimes.length / 2)] ?? 0) : null;

    const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

    return {
      revenue,
      revenueDelta: pct(revenue, prevRevenue),
      count: orders.length,
      countDelta: pct(orders.length, prevOrders.length),
      avgBasket,
      avgDelta: pct(avgBasket, prevAvg),
      medianService,
    };
  }, [orders, prevOrders]);

  const hourly = useMemo(() => {
    const byHour = new Map<number, number>();
    for (const order of orders) {
      const h = new Date(order.created_at).getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
    const hours = Array.from({ length: 17 }, (_, i) => i + 7); // 7h → 23h
    const max = Math.max(1, ...hours.map((h) => byHour.get(h) ?? 0));
    const peak = hours.reduce((best, h) => ((byHour.get(h) ?? 0) > (byHour.get(best) ?? 0) ? h : best), hours[0] ?? 7);
    return hours.map((h) => ({
      hour: h,
      count: byHour.get(h) ?? 0,
      pct: Math.round(((byHour.get(h) ?? 0) / max) * 100),
      isPeak: h === peak && (byHour.get(h) ?? 0) > 0,
    }));
  }, [orders]);

  const topItems = useMemo(() => {
    const orderIds = new Set(orders.map((o) => o.id));
    const agg = new Map<string, { qty: number; revenue: number }>();
    for (const line of lines) {
      if (!orderIds.has(line.order_id)) continue;
      const name = tr(line.name_snapshot) || "?";
      const cur = agg.get(name) ?? { qty: 0, revenue: 0 };
      cur.qty += line.qty;
      cur.revenue += line.qty * line.unit_price_millimes;
      agg.set(name, cur);
    }
    const sorted = [...agg.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const max = Math.max(1, ...sorted.map(([, v]) => v.qty));
    return sorted.map(([name, v]) => ({ name, ...v, pct: Math.round((v.qty / max) * 100) }));
  }, [orders, lines, tr]);

  const hasData = orders.length > 0;

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
