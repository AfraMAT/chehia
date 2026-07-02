"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatClock, formatTimer, type OrderStatus } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { ZelligeMark } from "@/components/brand";
import { usePortal } from "../portal-provider";
import { useLiveOrders, type LiveOrder } from "../use-live-orders";

const LATE_AFTER_MS = 8 * 60 * 1000;

/** W2 · Kitchen display — dark by design (glare, grease, distance), timers escalate, big targets. */
export default function KitchenPage() {
  const { restaurant } = usePortal();
  const { t, lang } = useI18n();
  const { orders, tables, setOrderStatus } = useLiveOrders(restaurant.id, { sound: true });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const columns: { key: OrderStatus; title: string; dot: string; orders: LiveOrder[] }[] = [
    { key: "new", title: t.portal.kitchen.toPrepare, dot: "bg-harissa-soft", orders: orders.filter((o) => o.status === "new") },
    { key: "preparing", title: t.portal.kitchen.inProgress, dot: "bg-kwarning", orders: orders.filter((o) => o.status === "preparing") },
    { key: "ready", title: t.portal.kitchen.ready, dot: "bg-ksuccess", orders: orders.filter((o) => o.status === "ready") },
  ];

  const avgMinutes = (() => {
    const prepping = orders.filter((o) => o.accepted_at);
    if (prepping.length === 0) return null;
    const total = prepping.reduce((s, o) => s + (now.getTime() - new Date(o.accepted_at as string).getTime()), 0);
    return Math.max(1, Math.round(total / prepping.length / 60000));
  })();

  const tableLabel = (id: string) => tables.find((tb) => tb.id === id)?.label ?? "?";

  return (
    <div className="min-h-dvh bg-kbg flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-kline-subtle flex-wrap">
        <Link href="/business/orders" className="flex items-center gap-3">
          <ZelligeMark size={32} />
          <span className="font-display font-extrabold text-[22px] text-ktext">
            {t.portal.kitchen.title} — {restaurant.name}
          </span>
        </Link>
        <div className="flex-1" />
        <span className="text-[13px] font-extrabold text-ktext-muted bg-kcard border border-kline rounded-full px-4 py-2">
          {orders.length} {t.portal.kitchen.openTickets}
        </span>
        {avgMinutes !== null && (
          <span className="text-[13px] font-extrabold text-ktext-muted bg-kcard border border-kline rounded-full px-4 py-2">
            {t.portal.kitchen.avgTime} · {avgMinutes} {t.common.min}
          </span>
        )}
        <span className="font-display font-extrabold text-[26px] text-ktext tabular-nums" dir="ltr">
          {formatClock(now, lang)}
        </span>
      </header>

      {/* Columns */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4.5 p-6 gap-5 content-start">
        {columns.map((col) => (
          <div key={col.key} className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-[9px] h-[9px] rounded-full ${col.dot}`} />
              <span className="font-extrabold text-sm text-ktext tracking-wider">
                {col.title} · {col.orders.length}
              </span>
            </div>

            {col.orders.map((order) => (
              <KitchenTicket
                key={order.id}
                order={order}
                label={tableLabel(order.table_id)}
                now={now}
                onAdvance={(status) => void setOrderStatus(order.id, status)}
              />
            ))}

            {col.key === "ready" && (
              <div className="flex-1 min-h-[120px] border-[1.5px] border-dashed border-kline rounded-2xl flex items-center justify-center">
                <span className="text-[13px] font-bold text-muted">{t.portal.kitchen.servedDisappear}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function KitchenTicket({
  order,
  label,
  now,
  onAdvance,
}: {
  order: LiveOrder;
  label: string;
  now: Date;
  onAdvance: (status: OrderStatus) => void;
}) {
  const { t, tr } = useI18n();
  const since = order.status === "new" ? order.created_at : (order.accepted_at ?? order.created_at);
  const elapsedMs = now.getTime() - new Date(since).getTime();
  const late = order.status === "preparing" && elapsedMs > LATE_AFTER_MS;
  const timer = formatTimer(since, now);

  const isNew = order.status === "new";
  const isReady = order.status === "ready";

  return (
    <div
      className={`bg-kcard rounded-2xl p-4.5 flex flex-col gap-3 p-4 ${
        isNew
          ? "border-2 border-harissa shadow-[0_10px_30px_rgba(188,75,38,0.15)]"
          : late
            ? "border border-klate"
            : isReady
              ? "border border-ksuccess-border opacity-90"
              : "border border-kline"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display font-extrabold text-[30px] text-ktext">T{label}</span>
        <span
          className={`text-[13px] font-extrabold rounded-full px-3.5 py-1.5 tabular-nums ${
            isNew
              ? "text-harissa-soft bg-harissa/15"
              : late
                ? "text-kdanger bg-danger/20 animate-ch-pulse"
                : isReady
                  ? "text-ksuccess-soft bg-success/15"
                  : "text-kwarning-soft bg-kwarning/15"
          }`}
          dir="ltr"
        >
          {isReady ? t.portal.kitchen.readyCall : late ? `${timer} — ${t.portal.kitchen.late}` : timer}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-dashed border-kline pt-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex flex-col gap-0.5">
            <span className="text-[17px] font-extrabold text-ktext">
              {item.qty} × {tr(item.name_snapshot)}
            </span>
            {(item.modifiers_snapshot.length > 0 || item.note) && (
              <span className="text-[13.5px] font-semibold text-ktext-soft ps-4">
                — {[...item.modifiers_snapshot.map((m) => tr(m.choice)), item.note].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        ))}
        {order.note && (
          <span className="text-[13.5px] font-semibold text-kwarning-soft">— {order.note}</span>
        )}
      </div>

      {isNew ? (
        <button
          type="button"
          onClick={() => onAdvance("preparing")}
          className="h-[52px] rounded-lg bg-harissa text-white font-extrabold text-base cursor-pointer hover:bg-harissa-pressed transition-colors"
        >
          {t.portal.kitchen.start}
        </button>
      ) : isReady ? (
        <button
          type="button"
          onClick={() => onAdvance("served")}
          className="h-[52px] rounded-lg border-2 border-ksuccess text-ksuccess-soft font-extrabold text-base cursor-pointer hover:bg-success/10 transition-colors"
        >
          {t.portal.kitchen.served}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAdvance("ready")}
          className="h-[52px] rounded-lg bg-success text-white font-extrabold text-base cursor-pointer hover:opacity-90 transition-opacity"
        >
          {t.portal.kitchen.markReady}
        </button>
      )}
    </div>
  );
}
