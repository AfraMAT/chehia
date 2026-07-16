"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { ensureCustomerSession, getSupabase } from "@/lib/supabase";
import { storageGet, storageSet } from "@/lib/storage";
import { useI18n } from "@/components/i18n-provider";
import { Skeleton } from "@/components/ui";
import { useVenue } from "./venue-provider";
import { WaiterSheet } from "./waiter-sheet";
import { RatingSheet } from "./rating-sheet";

/** P5/P9 · Order tracking — live via realtime, animated preparing state, waiter one tap away. */
export function OrderScreen({ orderId }: { orderId: string }) {
  const { restaurant, table, basePath, activeOrders, forgetOrder, online } = useVenue();
  const { t, tr, lang } = useI18n();

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderItem[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Distinct from loadFailed (genuine not-found): the order could not be loaded
  // at all — offline on a cold-start, or the realtime socket never connected.
  // Surfaces an escapable screen so the skeleton can never trap the customer.
  const [loadStalled, setLoadStalled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [ratingOpen, setRatingOpen] = useState(false);
  // Bumped by a 30s interval while the order is open, so the rough ETA re-renders
  // and ticks down instead of freezing at the value computed on first paint.
  const [, setTick] = useState(0);
  const ratedKey = `chehia.rated.${orderId}`;
  // === true (not !== false): when the reviews backend isn't deployed the column
  // is absent → undefined → reviews stay OFF, so no rating sheet pops to a
  // submit that would 404. A real venue row defaults reviews_enabled=true.
  const reviewsOn = restaurant.reviews_enabled === true;

  // Initial load + realtime subscription on this order row. The initial
  // fetch only fills the empty state (never clobbers a realtime update);
  // once the channel joins we refetch to close the pre-join gap.
  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchOrder = async (overwrite: boolean) => {
      const { data: o, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle<Order>();
      if (cancelled) return;
      // A transient network/DB error must not masquerade as a missing order —
      // keep the loading state and let the realtime subscribe + refetch recover
      // (the stall timer below is the backstop if recovery never comes).
      if (error) return;
      if (!o) {
        setLoadFailed(true);
        return;
      }
      setLoadFailed(false);
      setLoadStalled(false);
      setOrder((prev) => (overwrite || !prev ? o : prev));
    };

    // Backstop: if nothing loads within a few seconds (offline cold-start, a
    // blocked/failed realtime socket), stop spinning forever and offer a way out.
    const stallTimer = setTimeout(() => {
      if (!cancelled) setLoadStalled(true);
    }, 7000);

    // The lines query is independent of the order query — on flaky Wi-Fi one can
    // fail while the other succeeds, leaving a "0 items" summary. Retried on the
    // channel-join refetch until it lands.
    let linesLoaded = false;
    const fetchLines = async () => {
      const { data: li, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)
        .overrideTypes<OrderItem[], { merge: false }>();
      if (cancelled || error || !li) return;
      linesLoaded = true;
      setLines(li);
    };

    void (async () => {
      // Ensure the anonymous session is loaded before reading under RLS — covers
      // landing directly on the order URL (return-to-order, refresh) before any
      // prior action established a session in this tab.
      await ensureCustomerSession().catch(() => {});
      if (cancelled) return;

      void fetchOrder(false);
      await fetchLines();

      channel = supabase
        .channel(`order-${orderId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
          (payload) => setOrder((prev) => ({ ...(prev as Order), ...(payload.new as Order) })),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void fetchOrder(true);
            if (!linesLoaded) void fetchLines();
          }
        });
    })();

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId, reloadKey]);

  // Stop tracking once the order is done, so the "return to your order" banner
  // clears and doesn't surface to the next customer at the same table.
  useEffect(() => {
    if (order && (order.status === "served" || order.status === "cancelled")) {
      forgetOrder(orderId);
    }
  }, [order, orderId, forgetOrder]);

  // A meal is often several sends — surface the customer's other open orders at
  // this table so placing a follow-up never "loses" the previous one.
  const otherIds = useMemo(() => activeOrders.map((o) => o.id).filter((id) => id !== orderId), [activeOrders, orderId]);
  const [fetchedOthers, setFetchedOthers] = useState<Pick<Order, "id" | "order_number" | "status">[]>([]);
  useEffect(() => {
    if (otherIds.length === 0) return; // render filters against otherIds below
    let cancelled = false;
    void getSupabase()
      .from("orders")
      .select("id,order_number,status")
      .in("id", otherIds)
      .then(({ data }) => {
        if (!cancelled && data) {
          setFetchedOthers(data as Pick<Order, "id" | "order_number" | "status">[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [otherIds]);
  // Keep most-recent-first ordering from activeOrders; a forgotten/finished id
  // drops out here without needing a state reset inside the effect.
  const otherOrders = useMemo(() => {
    const byId = new Map(fetchedOthers.map((o) => [o.id, o]));
    return otherIds.map((id) => byId.get(id)).filter((o): o is Pick<Order, "id" | "order_number" | "status"> => Boolean(o));
  }, [fetchedOthers, otherIds]);

  // Invite a rating once, the moment the order is served — never nag: a persisted
  // flag means it won't reopen on refresh, but the customer can still tap "Rate".
  useEffect(() => {
    if (order?.status === "served" && reviewsOn && lines.length > 0 && !storageGet(ratedKey)) {
      storageSet(ratedKey, "1");
      setRatingOpen(true);
    }
  }, [order?.status, reviewsOn, lines.length, ratedKey]);

  // Tick every 30s while the order is still being prepared so the rough ETA
  // stays live. Stops once ready/served/cancelled — no work while nothing counts down.
  const counting = order?.status === "new" || order?.status === "preparing";
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, [counting]);

  // Realtime is the fast path, but a socket can die silently on café Wi-Fi and
  // the status would freeze forever. While the order is still moving, poll
  // slowly and refetch whenever the tab becomes visible again as a safety net.
  const stillMoving = !order || (order.status !== "served" && order.status !== "cancelled");
  useEffect(() => {
    if (!stillMoving) return;
    const supabase = getSupabase();
    const refetch = async () => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle<Order>();
      if (o) setOrder((prev) => (prev ? { ...prev, ...o } : o));
    };
    const id = window.setInterval(() => void refetch(), 25000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stillMoving, orderId]);

  // Fire a one-time cue the moment the kitchen marks the order ready, so a
  // customer who set the phone down on the table notices without watching it:
  // a short vibration (where supported) plus a title flash in the tab.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const s = order?.status;
    if (!s) return;
    if (prevStatusRef.current && prevStatusRef.current !== s && s === "ready") {
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        /* vibration unsupported — the title flash still fires */
      }
      const prevTitle = document.title;
      document.title = `✅ ${t.order.ready}`;
      window.setTimeout(() => {
        document.title = prevTitle;
      }, 4000);
    }
    prevStatusRef.current = s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

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
    // Load stalled (offline / socket never connected) → escapable screen with a
    // retry and a way back to the menu, so the skeleton can't trap the customer.
    if (loadStalled) {
      return (
        <div className="flex flex-col min-h-dvh">
          <header className="px-5 pt-4 flex items-center">
            <Link
              href={`${base}/menu`}
              aria-label={t.common.back}
              className="w-10 h-10 rounded-full bg-white border-[1.5px] border-line flex items-center justify-center text-ink font-extrabold text-[17px]"
            >
              <span className="rtl:rotate-180 -mt-0.5">‹</span>
            </Link>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="font-display font-extrabold text-xl text-ink">
              {online ? t.errors.generic : t.errors.network}
            </span>
            {!online && <span className="text-[13.5px] font-semibold text-muted">{t.errors.networkBody}</span>}
            <button
              type="button"
              onClick={() => {
                setLoadStalled(false);
                setReloadKey((k) => k + 1);
              }}
              className="mt-1 h-12 px-6 rounded-xl bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center shadow-[0_4px_12px_rgba(188,75,38,0.25)] cursor-pointer"
            >
              {t.offline.retryNow}
            </button>
            <Link
              href={`${base}/menu`}
              className="h-12 px-6 rounded-xl border-2 border-ink text-ink font-extrabold text-[15px] flex items-center justify-center"
            >
              {t.cart.browseMenu}
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col min-h-dvh">
        {/* Header */}
        <header className="px-5 pt-4 flex items-center justify-between">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
          <span className="w-10" />
        </header>
        {/* Status hero */}
        <div className="px-5 pt-7 pb-6 flex flex-col items-center gap-3.5">
          <Skeleton className="w-[88px] h-[88px] rounded-full" />
          <Skeleton className="h-7 w-2/3 mt-1" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        {/* Timeline card */}
        <div className="mx-5 bg-white border border-line rounded-2xl p-4 flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3.5 items-start">
              <Skeleton className="w-[26px] h-[26px] rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isServed = order.status === "served";
  const isCancelled = order.status === "cancelled";
  // Under table-confirmation mode a 'new' order is not yet in the kitchen — a
  // waiter must confirm it at the table first. Say so instead of "sent to kitchen".
  const awaitingConfirm = order.status === "new" && restaurant.require_table_confirmation === true;

  const statusTitle = isCancelled
    ? t.order.cancelled
    : isServed
      ? t.order.servedTitle
      : order.status === "ready"
        ? t.order.ready
        : order.status === "preparing"
          ? t.order.preparing
          : awaitingConfirm
            ? t.order.awaiting
            : t.order.received;

  const servedInMin =
    order.served_at && order.created_at
      ? Math.max(1, Math.round((new Date(order.served_at).getTime() - new Date(order.created_at).getTime()) / 60000))
      : null;

  const remaining = isServed || isCancelled ? null : remainingEstimate(order);
  const statusSubtitle = isServed
    ? t.order.servedSubtitle
    : isCancelled
      ? t.order.cancelledBody
      : awaitingConfirm
        ? t.order.awaitingBody
        : order.status === "ready"
          ? `${t.order.readyBody}${tableSuffix}`
          : remaining != null
            ? `${interpolate(t.order.remaining, { min: remaining })}${tableSuffix}`
            : `${t.order.soon}${tableSuffix}`;

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
        <div className="flex flex-col items-center gap-1" role="status" aria-live="polite">
          <h1 className="font-display font-extrabold text-[30px] text-ink text-center leading-tight">{statusTitle}</h1>
          <p className="text-sm font-semibold text-muted text-center leading-relaxed">{statusSubtitle}</p>
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
                title={awaitingConfirm ? t.order.awaiting : t.order.received}
                body={`${formatClock(new Date(order.created_at), lang)} — ${awaitingConfirm ? t.order.awaitingShort : t.order.receivedBody}`}
                hasLine
                lineActive={step >= 1}
              />
              <TimelineRow
                state={step >= 2 ? "done" : step === 1 ? "active" : "pending"}
                title={order.status === "ready" ? t.order.ready : t.order.preparing}
                body={order.status === "ready" ? t.order.readyBody : t.order.preparingBody}
                hasLine
                lineActive={step >= 2}
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

      {/* Other open orders from this device at this table (multi-send meals) */}
      {otherOrders.length > 0 && (
        <div className="mx-5 mt-3.5 flex flex-col gap-2">
          <span className="text-xs font-bold text-muted-soft tracking-wider uppercase">{t.order.othersTitle}</span>
          {otherOrders.map((o) => {
            const done = o.status === "served" || o.status === "cancelled";
            const label =
              o.status === "cancelled" ? t.order.cancelled
              : o.status === "served" ? t.order.servedTitle
              : o.status === "ready" ? t.order.ready
              : o.status === "preparing" ? t.order.preparing
              : t.order.received;
            return (
              <Link
                key={o.id}
                href={`${base}/order/${o.id}`}
                className="bg-white border border-line rounded-xl px-3.5 py-3 flex items-center gap-2.5"
              >
                <span
                  className={`w-[9px] h-[9px] rounded-full shrink-0 ${
                    o.status === "cancelled" ? "bg-danger" : done ? "bg-success" : "bg-warning"
                  }`}
                />
                <span className="flex-1 font-extrabold text-[13.5px] text-ink">#{o.order_number}</span>
                <span className="text-[12.5px] font-semibold text-muted-soft">{label}</span>
                <span className="text-muted-soft font-extrabold rtl:rotate-180">›</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-h-6" />

      {/* Actions */}
      <div className="px-4 flex flex-col gap-2.5">
        {isServed ? (
          <>
            {reviewsOn && (
              <button
                type="button"
                onClick={() => setRatingOpen(true)}
                className="h-[54px] rounded-xl bg-harissa text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(188,75,38,0.3)] cursor-pointer"
              >
                <span style={{ fontSize: 18 }}>🌟</span>
                {t.rating.rateCta}
              </button>
            )}
            <Link
              href={`${base}/menu`}
              className={`h-12 rounded-lg font-extrabold text-[14.5px] flex items-center justify-center ${
                reviewsOn ? "bg-harissa-tint text-harissa-pressed" : "bg-harissa text-white shadow-[0_6px_16px_rgba(188,75,38,0.3)]"
              }`}
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
      {ratingOpen && <RatingSheet orderId={orderId} lines={lines} onClose={() => setRatingOpen(false)} />}
    </div>
  );
}

/**
 * Rough countdown from a ~8 min baseline. Returns null once the estimate would
 * fall to zero (or the device clock is skewed out of a sane band) so the UI can
 * fall back to an honest status phrase ("Bientôt prête") instead of freezing at
 * a fake "~1 min" that never moves.
 */
function remainingEstimate(order: Order): number | null {
  const remaining = Math.round(8 - (Date.now() - new Date(order.created_at).getTime()) / 60000);
  return remaining >= 1 && remaining <= 8 ? remaining : null;
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
