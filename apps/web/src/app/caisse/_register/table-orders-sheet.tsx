"use client";

import { currencyLabel, millimesToDisplay } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse, type UnpaidOrder } from "../caisse-provider";

/**
 * Counter settlement: the cashier pulls up a customer's QR order and takes
 * payment, so its cash posts to the open drawer and the Z-report — the fix for
 * QR revenue never reaching the till. Picking one opens the tender sheet on it.
 */
export function TableOrdersSheet({ onClose, onPay }: { onClose: () => void; onPay: (o: UnpaidOrder) => void }) {
  const { t, tr, lang } = useI18n();
  const { unpaidOrders, cashSession } = useCaisse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label={t.caisse.common.close} className="absolute inset-0 bg-ink/50 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[460px] max-h-[86dvh] bg-cream rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(34,26,19,0.4)]">
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-line">
          <span className="font-display font-extrabold text-[18px] text-ink">{t.caisse.tableOrders.title}</span>
          <button type="button" onClick={onClose} aria-label={t.caisse.common.close} className="w-9 h-9 rounded-full bg-white border border-line text-ink font-extrabold cursor-pointer">✕</button>
        </div>

        {!cashSession && (
          <div className="shrink-0 mx-4 mt-3 flex items-center gap-2 bg-warning-tint text-warning-text rounded-lg px-3 py-2 text-[12.5px] font-bold">
            ⚠ {t.caisse.tableOrders.noDrawer}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
          {unpaidOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-1.5 text-center">
              <span className="font-extrabold text-[15px] text-ink">{t.caisse.tableOrders.empty}</span>
              <span className="text-[13px] text-muted">{t.caisse.tableOrders.emptyBody}</span>
            </div>
          )}
          {unpaidOrders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onPay(o)}
              className="text-start bg-card border border-line rounded-xl p-3.5 flex flex-col gap-2 hover:border-harissa transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-extrabold text-[16px] text-ink">
                  {t.common.table} {o.table_label} · #{o.order_number}
                </span>
                <span className="font-display font-extrabold text-[17px] text-harissa-pressed" dir="ltr">
                  {millimesToDisplay(o.total_millimes, lang)} {currencyLabel(lang)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {o.lines.map((l) => (
                  <span key={l.id} className="text-[12.5px] font-semibold text-muted">
                    {l.qty}× {tr(l.name_snapshot)}
                    {l.modifiers_snapshot.length > 0 && ` — ${l.modifiers_snapshot.map((m) => tr(m.choice)).join(", ")}`}
                  </span>
                ))}
              </div>
              <span className="self-start mt-0.5 text-[11px] font-extrabold text-harissa-pressed bg-harissa-tint rounded-full px-2.5 py-1">
                {t.caisse.tableOrders.pay} →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
