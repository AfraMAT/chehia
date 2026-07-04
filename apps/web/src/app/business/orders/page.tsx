"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  currencyLabel,
  formatCount,
  formatElapsed,
  millimesToDisplay,
  type OrderStatus,
} from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { Toggle } from "@/components/ui";
import { usePortal } from "../portal-provider";
import { useLiveOrders, type LiveOrder } from "../use-live-orders";

/** W1 · Live orders — realtime feed, new-order ring + sound, floor map, waiter calls. */
export default function OrdersPage() {
  const { restaurant } = usePortal();
  const { t, lang } = useI18n();
  const [soundOn, setSoundOn] = useState(true);
  const { orders, tables, calls, todayCount, todayRevenue, setOrderStatus, acknowledgeCall, loading } =
    useLiveOrders(restaurant.id, { sound: soundOn });

  const orderByTable = useMemo(() => {
    const map = new Map<string, LiveOrder>();
    for (const order of orders) {
      const existing = map.get(order.table_id);
      // Highest-urgency order represents the table: new > preparing > ready.
      if (!existing || urgency(order.status) > urgency(existing.status)) map.set(order.table_id, order);
    }
    return map;
  }, [orders]);

  const zones = useMemo(() => new Set(tables.map((tb) => tb.zone)).size, [tables]);

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Top bar */}
      <div className="flex items-center gap-3.5 px-6 pt-4.5 pb-3.5 pt-5 flex-wrap">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.portal.orders.title}</h1>
        <span className="inline-flex items-center gap-2 bg-success-tint text-success-text font-extrabold text-xs px-3 py-1.5 rounded-full">
          <span className="w-[7px] h-[7px] rounded-full bg-success animate-ch-pulse" />
          {t.portal.orders.live}
        </span>
        <div className="flex-1" />
        <span className="text-[12.5px] font-bold text-muted bg-card border border-line rounded-full px-3.5 py-2" dir="ltr">
          {t.portal.orders.today} · {todayCount} {t.portal.nav.orders.toLowerCase()} ·{" "}
          {formatCount(Math.round(todayRevenue / 1000))} {currencyLabel(lang)}
        </span>
        <span className="inline-flex items-center gap-2 text-[12.5px] font-extrabold text-ink bg-card border border-line rounded-full px-3.5 py-1.5">
          <Toggle checked={soundOn} onChange={setSoundOn} label={t.portal.orders.sound} />
          {t.portal.orders.sound}
        </span>
      </div>

      <div className="flex-1 flex gap-4.5 px-6 pb-5 min-h-0 items-start gap-5">
        {/* Order cards column */}
        <div className="w-[352px] shrink-0 flex flex-col gap-3">
          {loading && <div className="text-sm text-muted-soft px-2 py-4">{t.common.loading}</div>}
          {!loading && orders.length === 0 && (
            <div className="bg-card border border-line rounded-2xl p-6 flex flex-col gap-1.5">
              <span className="font-extrabold text-[15px] text-ink">{t.portal.orders.empty}</span>
              <span className="text-[13px] text-muted leading-relaxed">{t.portal.orders.emptyBody}</span>
            </div>
          )}
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              tableLabel={tables.find((tb) => tb.id === order.table_id)?.label ?? "?"}
              onAdvance={(status) => void setOrderStatus(order.id, status)}
            />
          ))}
        </div>

        {/* Floor plan */}
        <div className="flex-1 bg-card border border-line rounded-2xl p-4.5 flex flex-col gap-3.5 min-w-0 p-5 self-stretch">
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="font-extrabold text-[15px] text-ink">{t.portal.orders.floorPlan}</span>
            <span className="text-[11.5px] font-bold text-muted-soft">
              {tables.length} {t.portal.orders.tables} · {zones} {t.portal.orders.zones}
            </span>
            <div className="flex-1" />
            <LegendDot color="bg-disabled" label={t.portal.orders.free} textClass="text-muted" />
            <LegendDot color="bg-harissa" label={t.portal.orders.newOrder} textClass="text-harissa-pressed" />
            <LegendDot color="bg-warning" label={t.order.preparing} textClass="text-warning-text" />
            <LegendDot color="bg-success" label={t.order.ready} textClass="text-success-text" />
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {tables.map((tb) => {
              const order = orderByTable.get(tb.id);
              const st = order?.status;
              const style =
                st === "new"
                  ? { bg: "bg-harissa-tint", border: "border-harissa", dot: "bg-harissa", text: "text-harissa-pressed", label: t.portal.orders.newOrder, pulse: true }
                  : st === "preparing"
                    ? { bg: "bg-warning-tint", border: "border-warning-border", dot: "bg-warning", text: "text-warning-text", label: t.order.preparing, pulse: false }
                    : st === "ready"
                      ? { bg: "bg-success-tint", border: "border-success-border", dot: "bg-success", text: "text-success-text", label: t.order.ready, pulse: false }
                      : { bg: "bg-card", border: "border-line", dot: "bg-disabled", text: "text-muted-soft", label: t.portal.orders.free, pulse: false };
              return (
                <div key={tb.id} className={`rounded-lg border-[1.5px] ${style.border} ${style.bg} px-3.5 py-3 flex flex-col gap-1.5 min-h-[86px]`}>
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold text-[17px] text-ink">T{tb.label}</span>
                    <span className={`w-[9px] h-[9px] rounded-full ${style.dot} ${style.pulse ? "animate-ch-pulse" : ""}`} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-[11.5px] font-extrabold ${style.text}`}>{style.label}</span>
                    <span className="text-[10.5px] font-semibold text-muted-soft">
                      {tb.zone}
                      {order ? " · " : ""}
                      {order && <Elapsed since={order.created_at} compact />}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Waiter calls */}
          {calls.map((call) => {
            const tb = tables.find((x) => x.id === call.table_id);
            const reasonLabel = {
              bill: t.waiter.bill,
              water: t.waiter.water,
              cutlery: t.waiter.cutlery,
              other: call.note || t.waiter.other,
            }[call.reason];
            return (
              <div key={call.id} className="bg-sand rounded-lg px-3.5 py-2.5 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-harissa animate-ch-pulse shrink-0" />
                <span className="text-[12.5px] font-bold text-ink flex-1 min-w-0 truncate">
                  {t.common.table} {tb?.label ?? "?"} — {t.portal.orders.waiterRequest} :{" "}
                  <span className="text-harissa-pressed">{reasonLabel}</span> ·{" "}
                  <Elapsed since={call.created_at} compact />
                </span>
                <button
                  type="button"
                  onClick={() => void acknowledgeCall(call.id)}
                  className="text-xs font-extrabold text-white bg-ink rounded-full px-3.5 py-1.5 cursor-pointer shrink-0"
                >
                  {t.portal.orders.handled}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function urgency(status: OrderStatus): number {
  return status === "new" ? 3 : status === "preparing" ? 2 : status === "ready" ? 1 : 0;
}

/**
 * Self-updating elapsed-time label. Each instance owns its own 1s ticker so the
 * parent order/floor tree doesn't re-render every second — only the timestamps do.
 * `compact` shows just the largest unit (floor tiles, waiter calls); the default
 * shows min + sec (order cards).
 */
const Elapsed = memo(function Elapsed({
  since,
  compact = false,
  prefix,
}: {
  since: string;
  compact?: boolean;
  prefix?: string;
}) {
  const { t } = useI18n();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(since);
  const label = compact
    ? elapsed.minutes > 0
      ? `${elapsed.minutes} ${t.common.min}`
      : `${elapsed.seconds} ${t.common.seconds}`
    : elapsed.minutes > 0
      ? `${elapsed.minutes} ${t.common.min} ${elapsed.seconds} ${t.common.seconds}`
      : `${elapsed.seconds} ${t.common.seconds}`;

  return (
    <span dir="ltr">
      {prefix ? `${prefix} ` : ""}
      {label}
    </span>
  );
});

function LegendDot({ color, label, textClass }: { color: string; label: string; textClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${textClass}`}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function OrderCard({
  order,
  tableLabel,
  onAdvance,
}: {
  order: LiveOrder;
  tableLabel: string;
  onAdvance: (status: OrderStatus) => void;
}) {
  const { t, tr, lang } = useI18n();
  const isNew = order.status === "new";

  const statusLabel = isNew ? t.portal.orders.newOrder : order.status === "preparing" ? t.order.preparing : t.order.ready;

  return (
    <div
      className={`bg-card rounded-2xl p-4 flex flex-col gap-3 ${
        isNew
          ? "border-2 border-harissa shadow-[0_8px_24px_rgba(188,75,38,0.16)]"
          : "border border-line"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 ${
            isNew ? "bg-harissa text-white" : order.status === "preparing" ? "bg-warning-tint text-warning-text" : "bg-success-tint text-success-text"
          }`}
        >
          <span className="text-[9px] font-extrabold opacity-80 tracking-wider">TABLE</span>
          <span className="font-display font-extrabold text-[17px] leading-none">{tableLabel}</span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-extrabold text-[14.5px] text-ink truncate">
            #{order.order_number} · {statusLabel}
          </span>
          <span className={`text-xs font-bold ${isNew ? "text-harissa-pressed" : "text-warning-text"}`}>
            <Elapsed since={order.created_at} prefix={isNew ? t.portal.orders.ago : t.portal.orders.since} />
          </span>
          {order.origin === "browse" && (
            <span className="self-start mt-0.5 text-[10px] font-extrabold text-teal-pressed bg-teal-tint rounded-full px-2 py-0.5">
              {t.portal.orders.remoteOrder}
            </span>
          )}
        </div>
        {isNew && <span className="ms-auto w-2.5 h-2.5 rounded-full bg-harissa animate-ch-pulse shrink-0" />}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-dashed border-line pt-2.5">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-2">
            <span className="text-[13.5px] font-bold text-ink">
              {item.qty}× {tr(item.name_snapshot)}
              {item.modifiers_snapshot.length > 0 && (
                <span className="text-muted-soft font-semibold">
                  {" "}
                  — {item.modifiers_snapshot.map((m) => tr(m.choice)).join(", ")}
                </span>
              )}
              {item.note && <span className="text-muted-soft font-semibold"> · {item.note}</span>}
            </span>
            <span className="text-[13.5px] font-bold text-ink shrink-0" dir="ltr">
              {millimesToDisplay(item.unit_price_millimes * item.qty, lang)}
            </span>
          </div>
        ))}
        <div className="flex justify-between items-center mt-0.5">
          {order.note ? (
            <span className="text-[11.5px] font-extrabold text-warning-text bg-warning-tint rounded-full px-2.5 py-1">
              {t.portal.orders.note} : {order.note}
            </span>
          ) : (
            <span />
          )}
          <span className="font-extrabold text-sm text-ink" dir="ltr">
            {millimesToDisplay(order.total_millimes, lang)} {currencyLabel(lang)}
          </span>
        </div>
      </div>

      {isNew ? (
        <button
          type="button"
          onClick={() => onAdvance("preparing")}
          className="h-11 rounded-md bg-harissa text-white font-extrabold text-sm cursor-pointer hover:bg-harissa-pressed transition-colors"
        >
          {t.portal.orders.accept}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAdvance("served")}
          className="h-[42px] rounded-md border-2 border-ink text-ink font-extrabold text-[13.5px] cursor-pointer hover:bg-sand transition-colors"
        >
          {t.portal.orders.markServed}
        </button>
      )}
    </div>
  );
}
