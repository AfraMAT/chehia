"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  currencyLabel,
  formatClock,
  interpolate,
  millimesToDisplay,
  trackingStep,
  type Order,
  type OrderItem,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Skeleton } from "@/components/ui";
import { useVenue } from "./venue-provider";
import { WaiterSheet } from "./waiter-sheet";

/** P5/P9 · Order tracking — live via realtime, animated preparing state, waiter one tap away. */
export function OrderScreen({ orderId }: { orderId: string }) {
  const { table, basePath } = useVenue();
  const { t, tr, lang } = useI18n();

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderItem[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Initial load + realtime subscription on this order row. The initial
  // fetch only fills the empty state (never clobbers a realtime update);
  // once the channel joins we refetch to close the pre-join gap.
  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    const fetchOrder = async (overwrite: boolean) => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle<Order>();
      if (cancelled) return;
      if (!o) {
        setLoadFailed(true);
        return;
      }
      setOrder((prev) => (overwrite || !prev ? o : prev));
    };

    void fetchOrder(false);
    void (async () => {
      const { data: li } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)
        .overrideTypes<OrderItem[], { merge: false }>();
      if (!cancelled) setLines(li ?? []);
    })();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => setOrder((prev) => ({ ...(prev as Order), ...(payload.new as Order) })),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void fetchOrder(true);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const base = basePath;
  const step = order ? trackingStep(order.status) : 0;
  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const tableSuffix = table ? ` · ${t.common.table} ${table.label}` : "";

  if (loadFailed) {
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center gap-3 px-8 text-center">
        <span className="font-display font-extrabold text-xl text-ink">{t.errors.generic}</span>
        <Link href={`${base}/menu`} className="text-harissa font-bold underline">
          {t.cart.browseMenu}
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col min-h-dvh px-5 pt-6 gap-4">
        <Skeleton className="h-10 w-2/3 mx-auto" />
        <Skeleton className="h-24 w-24 rounded-full mx-auto" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const isServed = order.status === "served";
  const isCancelled = order.status === "cancelled";

  const statusTitle = isCancelled
    ? t.order.cancelled
    : isServed
      ? t.order.servedTitle
      : order.status === "ready"
        ? t.order.ready
        : order.status === "preparing"
          ? t.order.preparing
          : t.order.received;

  const servedInMin =
    order.served_at && order.created_at
      ? Math.max(1, Math.round((new Date(order.served_at).getTime() - new Date(order.created_at).getTime()) / 60000))
      : null;

  return (
    <div className="flex flex-col min-h-dvh pb-4">
      {/* Header */}
      <header className="px-5 pt-4 flex items-center justify-between">
        <Link
          href={`${base}/menu`}
          aria-label={t.common.back}
          className="w-10 h-10 rounded-full bg-white border-[1.5px] border-line flex items-center justify-center text-ink font-extrabold text-[17px]"
        >
          <span className="rtl:rotate-180 -mt-0.5">‹</span>
        </Link>
        <span className="text-[13px] font-extrabold text-muted-soft tracking-widest uppercase">
          {t.order.order} #{order.order_number}
        </span>
        <span className="w-10" />
      </header>

      {/* Status hero */}
      <div className="px-5 pt-7 pb-6 flex flex-col items-center gap-3.5">
        {isServed ? (
          <div className="w-[92px] h-[92px] rounded-full bg-success-tint flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-success flex items-center justify-center text-white text-[26px] font-extrabold">
              ✓
            </div>
          </div>
        ) : isCancelled ? (
          <div className="w-[92px] h-[92px] rounded-full bg-danger-tint flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-danger flex items-center justify-center text-white text-[26px] font-extrabold">
              ✕
            </div>
          </div>
        ) : (
          <div className="relative w-[88px] h-[88px] rounded-full bg-warning-tint flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-warning animate-ch-ping" />
            <div className="flex gap-1.5 items-end" aria-hidden>
              <span className="w-[9px] h-[22px] rounded bg-warning animate-ch-bar origin-bottom" />
              <span className="w-[9px] h-[30px] rounded bg-warning animate-ch-bar origin-bottom [animation-delay:0.18s]" />
              <span className="w-[9px] h-4 rounded bg-warning animate-ch-bar origin-bottom [animation-delay:0.36s]" />
            </div>
          </div>
        )}
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-display font-extrabold text-[30px] text-ink text-center leading-tight">{statusTitle}</h1>
          <p className="text-sm font-semibold text-muted text-center leading-relaxed">
            {isServed
              ? t.order.servedSubtitle
              : isCancelled
                ? t.order.cancelledBody
                : order.status === "ready"
                  ? `${t.order.readyBody}${tableSuffix}`
                  : `${interpolate(t.order.remaining, { min: remainingEstimate(order) })}${tableSuffix}`}
          </p>
        </div>
      </div>

      {/* Served: receipt recap (P9). Otherwise: timeline (P5). */}
      {isServed ? (
        <div className="mx-5 bg-white border border-line rounded-2xl px-4.5 py-4 flex flex-col gap-2.5 p-4">
          <div className="flex justify-between items-center border-b border-dashed border-line-strong pb-2.5">
            <span className="font-extrabold text-[13px] text-muted-soft tracking-wider uppercase">
              {table ? `${t.common.table} ${table.label} · ` : ""}
              {formatClock(new Date(order.served_at ?? order.created_at), lang)}
            </span>
            {servedInMin && (
              <span className="text-[11px] font-extrabold text-success-text bg-success-tint rounded-full px-2.5 py-1">
                {interpolate(t.order.servedIn, { min: servedInMin })}
              </span>
            )}
          </div>
          {lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-2">
              <span className="text-sm font-bold text-ink">
                {line.qty}× {tr(line.name_snapshot)}
                {line.modifiers_snapshot.length > 0 && (
                  <span className="text-muted-soft font-semibold">
                    {" "}
                    — {line.modifiers_snapshot.map((m) => tr(m.choice)).join(", ")}
                  </span>
                )}
              </span>
              <span className="text-sm font-bold text-ink" dir="ltr">
                {millimesToDisplay(line.unit_price_millimes * line.qty, lang)}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-baseline border-t border-dashed border-line-strong pt-2.5">
            <span className="font-extrabold text-[15px] text-ink">{t.common.total}</span>
            <span className="font-display font-extrabold text-[22px] text-ink" dir="ltr">
              {millimesToDisplay(order.total_millimes, lang)}{" "}
              <span className="font-sans font-bold text-xs text-muted-soft">{currencyLabel(lang)}</span>
            </span>
          </div>
        </div>
      ) : (
        !isCancelled && (
          <>
            <div className="mx-5 bg-white border border-line rounded-2xl p-4.5 flex flex-col p-4">
              <TimelineRow
                state={step >= 1 ? "done" : "active"}
                title={t.order.received}
                body={`${formatClock(new Date(order.created_at), lang)} — ${t.order.receivedBody}`}
                hasLine
                lineActive={step >= 1}
              />
              <TimelineRow
                state={step >= 2 ? "done" : step === 1 ? "active" : "pending"}
                title={order.status === "ready" ? t.order.ready : t.order.preparing}
                body={order.status === "ready" ? t.order.readyBody : t.order.preparingBody}
                hasLine
                lineActive={false}
              />
              <TimelineRow state={step >= 2 ? "done" : "pending"} title={t.order.served} body={t.order.servedBody} />
            </div>

            {/* Collapsed summary */}
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="mx-5 mt-3 bg-white border border-line rounded-xl px-4 py-3.5 flex justify-between items-center cursor-pointer"
            >
              <div className="flex flex-col items-start gap-0.5 text-start">
                <span className="font-extrabold text-sm text-ink">
                  {count} {t.common.items} ·{" "}
                  <span dir="ltr">{millimesToDisplay(order.total_millimes, lang)}</span> {currencyLabel(lang)}
                </span>
                <span className="text-xs font-semibold text-muted-soft">
                  {lines.map((l) => `${l.qty}× ${tr(l.name_snapshot)}`).join(", ")}
                </span>
              </div>
              <span className={`text-muted-soft font-extrabold transition-transform ${detailsOpen ? "rotate-180" : ""}`}>
                ⌄
              </span>
            </button>
            {detailsOpen && (
              <div className="mx-5 mt-2 bg-white border border-line rounded-xl px-4 py-3 flex flex-col gap-2">
                {lines.map((line) => (
                  <div key={line.id} className="flex justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">
                      {line.qty}× {tr(line.name_snapshot)}
                      {line.modifiers_snapshot.length > 0 && (
                        <span className="text-muted-soft font-semibold">
                          {" "}
                          — {line.modifiers_snapshot.map((m) => tr(m.choice)).join(", ")}
                        </span>
                      )}
                      {line.note && <span className="text-muted-soft font-semibold"> · {line.note}</span>}
                    </span>
                    <span className="text-[13px] font-bold text-ink" dir="ltr">
                      {millimesToDisplay(line.unit_price_millimes * line.qty, lang)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}

      <div className="flex-1 min-h-6" />

      {/* Actions */}
      <div className="px-4 flex flex-col gap-2.5">
        {isServed ? (
          <>
            <Link
              href={`${base}/menu`}
              className="h-[54px] rounded-xl bg-harissa text-white font-extrabold text-base flex items-center justify-center shadow-[0_6px_16px_rgba(188,75,38,0.3)]"
            >
              {t.order.orderAgain}
            </Link>
            <button
              type="button"
              onClick={() => setWaiterOpen(true)}
              className="h-12 rounded-lg border-2 border-ink text-ink font-extrabold text-[14.5px] bg-card cursor-pointer"
            >
              {t.waiter.call}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setWaiterOpen(true)}
              className="h-[52px] rounded-xl border-2 border-ink text-ink font-extrabold text-[15.5px] bg-card flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-harissa" />
              {t.waiter.call}
            </button>
            <Link
              href={`${base}/menu`}
              className="h-[46px] rounded-lg bg-harissa-tint text-harissa-pressed font-extrabold text-[14.5px] flex items-center justify-center"
            >
              {t.order.orderMore}
            </Link>
          </>
        )}
      </div>

      {waiterOpen && <WaiterSheet onClose={() => setWaiterOpen(false)} />}
    </div>
  );
}

/** Rough countdown from a ~8 min baseline, clamped so it never claims zero. */
function remainingEstimate(order: Order): number {
  const elapsedMin = (Date.now() - new Date(order.created_at).getTime()) / 60000;
  return Math.max(1, Math.round(8 - elapsedMin));
}

function TimelineRow({
  state,
  title,
  body,
  hasLine = false,
  lineActive = false,
}: {
  state: "done" | "active" | "pending";
  title: string;
  body: string;
  hasLine?: boolean;
  lineActive?: boolean;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center">
        {state === "done" ? (
          <div className="w-[26px] h-[26px] rounded-full bg-teal text-white flex items-center justify-center text-[13px] font-extrabold shrink-0">
            ✓
          </div>
        ) : state === "active" ? (
          <div className="w-[26px] h-[26px] rounded-full bg-warning flex items-center justify-center shrink-0">
            <span className="w-2 h-2 rounded-full bg-white animate-ch-pulse" />
          </div>
        ) : (
          <div className="w-[26px] h-[26px] rounded-full border-2 border-line-strong shrink-0" />
        )}
        {hasLine && <div className={`w-0.5 flex-1 my-1 ${lineActive ? "bg-teal" : "bg-line-strong"}`} />}
      </div>
      <div className={`flex flex-col gap-0.5 ${hasLine ? "pb-4" : ""}`}>
        <span
          className={`font-extrabold text-[14.5px] ${
            state === "done" ? "text-ink" : state === "active" ? "text-warning-text" : "text-disabled"
          }`}
        >
          {title}
        </span>
        <span className={`text-[12.5px] font-semibold ${state === "pending" ? "text-disabled" : "text-muted-soft"}`}>
          {body}
        </span>
      </div>
    </div>
  );
}
