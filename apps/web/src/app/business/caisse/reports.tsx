"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice, type Language } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

/** POS reporting: sales by tender, TVA/timbre collected, and recent Z-reports. */

type Range = "today" | "week";

interface Summary {
  salesTotal: number;
  byMethod: Record<string, number>;
  orders: number;
  tax: number;
  timbre: number;
  refunds: number;
}

interface ClosedSession {
  id: string;
  closed_at: string;
  opening_float_millimes: number;
  expected_cash_millimes: number | null;
  counted_cash_millimes: number | null;
  over_short_millimes: number | null;
}

function sinceISO(range: Range): string {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.toISOString();
  }
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Read every row a filter matches, not just the first page.
 *
 * PostgREST caps each response at `max_rows` (1000 on Supabase) and gives no
 * signal that it truncated. These queries feed the Z-report money totals, so a
 * venue that took more than 1000 payments in the selected range simply saw a
 * smaller number and had no way to know. Pages until a short page comes back.
 *
 * The caller must supply a deterministic `.order()` — range pagination over an
 * unordered result can repeat or skip rows between pages.
 */
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await page(from, from + PAGE_SIZE - 1);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export function Reports() {
  const supabase = getSupabase();
  const { t, lang } = useI18n();
  const fmt = (m: number) => formatPrice(m, lang);
  const methodLabel: Record<string, string> = {
    cash: t.caisse.tender.cash,
    card: t.caisse.tender.card,
    d17: t.caisse.tender.d17,
    other: t.caisse.tender.other,
  };
  const [range, setRange] = useState<Range>("today");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sessions, setSessions] = useState<ClosedSession[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const since = sinceISO(range);
    // RLS scopes every table to the caller's venue, so no restaurant_id filter needed.
    // Every query is paged: these drive the money totals, and an unpaged read is
    // silently capped at PostgREST's max_rows (see fetchAllRows).
    const [payments, orders, closed] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from("payments")
          .select("method, amount_millimes, created_at")
          .gte("created_at", since)
          .order("created_at")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabase
          .from("orders")
          .select("tax_total_millimes, timbre_millimes, paid_at")
          .gte("paid_at", since)
          .not("paid_at", "is", null)
          .order("paid_at")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabase
          .from("cash_sessions")
          .select("id, closed_at, opening_float_millimes, expected_cash_millimes, counted_cash_millimes, over_short_millimes")
          .eq("status", "closed")
          .gte("closed_at", since)
          .order("closed_at", { ascending: false })
          .range(from, to),
      ),
    ]);

    const byMethod: Record<string, number> = {};
    let salesTotal = 0;
    for (const p of payments) {
      const m = (p.method as string) ?? "other";
      const amt = (p.amount_millimes as number) ?? 0;
      byMethod[m] = (byMethod[m] ?? 0) + amt;
      salesTotal += amt;
    }
    let tax = 0;
    let timbre = 0;
    for (const o of orders) {
      tax += (o.tax_total_millimes as number) ?? 0;
      timbre += (o.timbre_millimes as number) ?? 0;
    }
    const refunds = 0; // refunds UI not yet issued; kept for parity

    setSummary({ salesTotal, byMethod, orders: orders.length, tax, timbre, refunds });
    setSessions(closed as ClosedSession[]);
    setLoading(false);
  }, [range, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      {/* Range */}
      <div className="flex rounded-xl bg-sand p-1 gap-1 w-fit">
        {(["today", "week"] as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`h-9 px-4 rounded-lg text-[13px] font-extrabold cursor-pointer transition-colors ${
              range === r ? "bg-card text-harissa-pressed shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {r === "today" ? t.portal.stats.today : t.portal.stats.week}
          </button>
        ))}
      </div>

      {loading || !summary ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <Spinner className="text-harissa w-8 h-8" />
        </div>
      ) : (
        <>
          {/* Headline */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={t.portal.stats.sales} value={fmt(summary.salesTotal)} strong />
            <Stat label={t.portal.stats.orders} value={String(summary.orders)} />
            <Stat label={t.portal.caisse.vatCollected} value={fmt(summary.tax)} />
            <Stat label={t.caisse.receipt.stamp} value={fmt(summary.timbre)} />
          </div>

          {/* By tender */}
          <section className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="font-extrabold text-[15px] text-ink">{t.portal.caisse.byMethod}</h2>
            {Object.keys(summary.byMethod).length === 0 ? (
              <p className="text-[13px] text-muted-soft">{t.portal.caisse.noSales}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {["cash", "card", "d17", "other"].filter((m) => summary.byMethod[m]).map((m) => (
                  <div key={m} className="flex justify-between items-center">
                    <span className="text-[13.5px] font-bold text-ink">{methodLabel[m]}</span>
                    <span className="text-[13.5px] font-bold text-ink tabular-nums" dir="ltr">{fmt(summary.byMethod[m])}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Z-reports */}
          <section className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="font-extrabold text-[15px] text-ink">{t.portal.caisse.zTitle}</h2>
            {sessions.length === 0 ? (
              <p className="text-[13px] text-muted-soft">{t.portal.caisse.noClosings}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-muted-soft text-start">
                      <th className="font-bold pb-2 pe-3">{t.portal.caisse.closedAt}</th>
                      <th className="font-bold pb-2 pe-3 text-end">{t.caisse.drawer.expected}</th>
                      <th className="font-bold pb-2 pe-3 text-end">{t.caisse.drawer.counted}</th>
                      <th className="font-bold pb-2 text-end">{t.caisse.drawer.variance}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const os = s.over_short_millimes ?? 0;
                      return (
                        <tr key={s.id} className="border-t border-line">
                          <td className="py-2 pe-3 text-ink">{formatDate(s.closed_at, lang)}</td>
                          <td className="py-2 pe-3 text-ink tabular-nums text-end" dir="ltr">{fmt(s.expected_cash_millimes ?? 0)}</td>
                          <td className="py-2 pe-3 text-ink tabular-nums text-end" dir="ltr">{fmt(s.counted_cash_millimes ?? 0)}</td>
                          <td className={`py-2 tabular-nums text-end font-bold ${os < 0 ? "text-danger-text" : "text-teal-pressed"}`} dir="ltr">
                            {os > 0 ? "+" : ""}{fmt(os)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-[11.5px] font-bold uppercase tracking-wide text-muted-soft">{label}</span>
      <span className={`tabular-nums ${strong ? "font-display font-extrabold text-[22px] text-ink" : "font-extrabold text-[17px] text-ink"}`} dir="ltr">
        {value}
      </span>
    </div>
  );
}

function formatDate(iso: string, lang: Language): string {
  const locale = lang === "ar" ? "ar-TN" : lang === "en" ? "en-GB" : "fr-FR";
  try {
    return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
