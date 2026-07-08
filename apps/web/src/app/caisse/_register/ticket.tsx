"use client";

import { Stepper } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse } from "../caisse-provider";
import { money, txt } from "./util";

/** The working ticket (right rail): attributed lines, totals, and the checkout CTA. */
export function Ticket({ onCheckout }: { onCheckout: () => void }) {
  const { t } = useI18n();
  const { ticket, ticketCount, ticketTotal, setTicketQty, clearTicket } = useCaisse();
  const empty = ticket.lines.length === 0;

  return (
    <div className="w-full h-full flex flex-col bg-card">
      <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-line">
        <span className="font-display font-extrabold text-[17px] text-ink">
          {t.caisse.common.ticket} {ticketCount > 0 && <span className="text-muted-soft font-bold text-[14px]">· {ticketCount}</span>}
        </span>
        {!empty && (
          <button type="button" onClick={clearTicket} className="text-[12.5px] font-bold text-muted hover:text-danger-text cursor-pointer">
            {t.caisse.ticket.clear}
          </button>
        )}
      </div>

      {empty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-8 text-center">
          <span className="text-[15px] font-extrabold text-ink">{t.caisse.ticket.empty}</span>
          <span className="text-[13px] text-muted-soft">{t.caisse.ticket.emptyHint}</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {ticket.lines.map((line) => (
            <div key={line.key} className="bg-white border border-line rounded-xl px-3 py-2.5 flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-[14px] text-ink leading-tight">{txt(line.name)}</span>
                <span className="font-extrabold text-[14px] text-ink tabular-nums whitespace-nowrap" dir="ltr">
                  {money(line.unitPriceMillimes * line.qty)}
                </span>
              </div>
              {(line.modifierLabels.length > 0 || line.note) && (
                <span className="text-[11.5px] text-muted leading-snug">
                  {line.modifierLabels.map((m) => txt(m.choice)).join(" · ")}
                  {line.note ? `${line.modifierLabels.length ? " · " : ""}${line.note}` : ""}
                </span>
              )}
              <Stepper size="sm" value={line.qty} min={0} onChange={(q) => setTicketQty(line.key, q)} />
            </div>
          ))}
        </div>
      )}

      {/* Totals + checkout */}
      <div className="shrink-0 border-t border-line px-4 pt-3 pb-4 flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <span className="font-extrabold text-[15px] text-ink">{t.caisse.ticket.total}</span>
          <span className="font-display font-extrabold text-[26px] text-ink tabular-nums" dir="ltr">
            {money(ticketTotal)}
          </span>
        </div>
        <button
          type="button"
          disabled={empty}
          onClick={onCheckout}
          className="h-[54px] rounded-xl bg-harissa text-white font-extrabold text-[17px] flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none disabled:cursor-not-allowed"
        >
          {t.caisse.ticket.checkout}
        </button>
      </div>
    </div>
  );
}
