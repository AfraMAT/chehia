"use client";

import { useMemo, useState } from "react";
import type { CartLine } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse } from "../caisse-provider";
import { money } from "./util";
import { buildReceiptData } from "./receipt-types";
import { ReceiptView } from "./receipt";
import { encodeReceipt } from "./escpos";
import { printBytes } from "./thermal-print";

type Method = "cash" | "card" | "d17";
type Phase = "tender" | "placing" | "done";

/** Checkout: pick a tender, compute change for cash, fire the order to the kitchen. */
export function TenderSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const {
    ticketTotal, placeOrder, settleOrder, clearTicket, online, queueSale,
    ticket, restaurant, staff, fiscal, orderType, table, lastSale, setLastSale,
    settleTarget, setSettleTarget, refreshUnpaidOrders,
  } = useCaisse();
  // Paying an existing (QR) order picked from the counter list, vs a fresh ticket.
  const payingExisting = settleTarget !== null;
  const baseTotal = payingExisting ? settleTarget.total_millimes : ticketTotal;
  // Map the order's stored snapshot lines to CartLine shape for the receipt.
  const receiptLines: CartLine[] = payingExisting
    ? settleTarget.lines.map((l) => ({
        key: l.id,
        itemId: "",
        name: l.name_snapshot,
        qty: l.qty,
        unitPriceMillimes: l.unit_price_millimes,
        modifierIds: [],
        modifierLabels: (l.modifiers_snapshot ?? []).map((m) => ({ group: {}, choice: m.choice, delta: 0 })),
        note: l.note,
      }))
    : ticket.lines;
  const errorLabel = (code: string, fallback: string): string => {
    const map: Record<string, string> = {
      no_table: t.caisse.errors.noTable,
      rate_limited: t.caisse.errors.rateLimited,
      item_unavailable: t.caisse.errors.itemUnavailable,
      unknown_table: t.caisse.errors.unknownTable,
      network: t.caisse.errors.network,
      order_failed: t.caisse.errors.orderFailed,
      settle_failed: t.caisse.errors.settleFailed,
      empty: t.caisse.errors.emptyTicket,
    };
    return map[code] ?? fallback;
  };
  const [method, setMethod] = useState<Method>("cash");
  const [raw, setRaw] = useState(""); // tendered, in millimes, filled from the right
  const [phase, setPhase] = useState<Phase>("tender");
  const [result, setResult] = useState<{ change: number; orderNumber: string; fiscalNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Gross due = ticket + timbre (timbre only under réel). Cash is then rounded to
  // the venue's step. Mirrors the server so the displayed due + change match.
  const timbre = fiscal?.regime === "reel" ? fiscal.timbre_millimes ?? 0 : 0;
  const step = fiscal?.cash_rounding_millimes ?? 100;
  const grossDue = baseTotal + timbre;
  const cashDue = useMemo(() => (step > 0 ? Math.round(grossDue / step) * step : grossDue), [grossDue, step]);
  const tendered = Number(raw || 0);
  const change = Math.max(0, tendered - cashDue);
  const canConfirm = method !== "cash" || tendered >= cashDue;

  const confirm = async () => {
    setPhase("placing");
    setError(null);

    // Offline: store the sale locally and hand the cashier a provisional receipt.
    // It syncs (and gets its fiscal number) when the network returns. Only ticket
    // sales queue offline; an existing QR order must be settled online.
    if (!online && !payingExisting) {
      const q = await queueSale(method, method === "cash" ? tendered : null);
      if (!q.ok) {
        setError(t.caisse.errors.noTable);
        setPhase("tender");
        return;
      }
      setResult({ change, orderNumber: q.localId, fiscalNumber: "" });
      setPhase("done");
      return;
    }
    if (!online && payingExisting) {
      setError(t.caisse.errors.network);
      setPhase("tender");
      return;
    }

    // Existing QR order: it's already in the kitchen — settle it directly so its
    // cash posts to the open drawer. Fresh ticket: create (fires to kitchen) then
    // settle. Both settle paths are idempotent, so a retry is safe.
    let orderId: string;
    let orderNumber: string;
    if (payingExisting) {
      orderId = settleTarget.id;
      orderNumber = settleTarget.order_number;
    } else {
      const created = await placeOrder();
      if (!created.ok) {
        setError(errorLabel(created.code, t.caisse.errors.orderFailed));
        setPhase("tender");
        return;
      }
      orderId = created.order.id;
      orderNumber = created.order.order_number;
    }
    const settled = await settleOrder(orderId, method, method === "cash" ? tendered : null);
    if (!settled.ok) {
      setError(errorLabel(settled.code, t.caisse.errors.settleFailed));
      setPhase("tender");
      return;
    }
    const orderTypeLabel = { comptoir: "Comptoir", emporter: "À emporter", surplace: "Sur place" }[orderType];
    const tableLabel = payingExisting
      ? `Table ${settleTarget.table_label}`
      : orderType === "surplace"
        ? (table ? `Table ${table.label}` : "—")
        : orderTypeLabel;
    const tvaRate = fiscal?.tva_registered && fiscal?.regime === "reel" ? Number(fiscal.default_tva_rate) : 0;
    setLastSale(
      buildReceiptData({
        restaurant,
        fiscal,
        lines: receiptLines,
        subtotalMillimes: baseTotal,
        orderNumber,
        fiscalNumber: settled.fiscalNumber,
        orderTypeLabel: payingExisting ? "Sur place" : orderTypeLabel,
        tableLabel,
        staffName: staff.display_name,
        method,
        tenderedMillimes: method === "cash" ? tendered : null,
        amountMillimes: settled.amount,
        taxMillimes: settled.tax,
        tvaRate,
        timbreMillimes: settled.timbre,
        roundingMillimes: settled.rounding,
        changeMillimes: settled.change,
        dateISO: new Date().toISOString(),
      }),
    );
    setResult({ change: settled.change, orderNumber, fiscalNumber: settled.fiscalNumber });
    setPhase("done");
  };

  const finish = () => {
    if (payingExisting) {
      setSettleTarget(null);
      void refreshUnpaidOrders();
    } else {
      clearTicket();
    }
    onClose();
  };

  // Try the thermal printer (ESC/POS over WebUSB, kicking the drawer for cash);
  // fall back to the browser print dialog when no printer is reachable.
  const handlePrint = async () => {
    if (!lastSale) {
      window.print();
      return;
    }
    const bytes = encodeReceipt(lastSale, { openDrawer: method === "cash" });
    const res = await printBytes(bytes);
    if (!res.ok) window.print();
  };

  if (phase === "done" && result) {
    return (
      <Shell onClose={finish}>
        <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-teal-tint flex items-center justify-center text-teal-pressed text-2xl font-extrabold">✓</div>
          <span className="font-display font-extrabold text-xl text-ink">{t.caisse.tender.sent}</span>
          {!result.fiscalNumber && (
            <span className="text-[12px] font-bold text-ink bg-sand rounded-full px-3 py-1">
              {t.caisse.tender.offlineReceipt}
            </span>
          )}
          {method === "cash" && result.change > 0 && (
            <div className="w-full bg-sand rounded-xl px-5 py-3 flex items-center justify-between">
              <span className="font-bold text-[15px] text-ink">{t.caisse.tender.change}</span>
              <span className="font-display font-extrabold text-[26px] text-harissa-pressed tabular-nums" dir="ltr">{money(result.change)}</span>
            </div>
          )}
          {lastSale && <ReceiptView data={lastSale} />}
          <div className="flex gap-2 w-full mt-1">
            <button
              type="button"
              onClick={() => void handlePrint()}
              className="flex-1 h-[50px] rounded-xl bg-white border-[1.5px] border-line-strong text-ink font-extrabold text-[14px] cursor-pointer hover:border-harissa transition-colors"
            >
              {t.caisse.tender.printReceipt}
            </button>
            <button type="button" onClick={finish} className="flex-1 h-[50px] rounded-xl bg-ink text-cream font-extrabold text-[15px] cursor-pointer">
              {t.caisse.tender.newTicket}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose}>
      <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
        {/* Total due */}
        <div className="flex items-baseline justify-between">
          <span className="font-extrabold text-[15px] text-ink">{t.caisse.tender.due}</span>
          <span className="font-display font-extrabold text-[30px] text-ink tabular-nums" dir="ltr">
            {money(method === "cash" ? cashDue : grossDue)}
          </span>
        </div>

        {/* Tender method */}
        <div className="grid grid-cols-3 gap-2">
          {(["cash", "card", "d17"] as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`h-12 rounded-xl border-[1.5px] font-extrabold text-[14px] cursor-pointer transition-colors ${
                method === m ? "border-harissa bg-harissa-tint text-harissa-pressed" : "border-line-strong bg-white text-ink"
              }`}
            >
              {m === "cash" ? t.caisse.tender.cash : m === "card" ? t.caisse.tender.card : t.caisse.tender.d17}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <>
            {/* Quick cash + tendered/change */}
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="font-bold text-muted">{t.caisse.tender.tendered}</span>
              <span className="font-extrabold text-ink tabular-nums" dir="ltr">{money(tendered)}</span>
            </div>
            <div className="flex gap-2">
              <QuickCash label={t.caisse.tender.exact} onClick={() => setRaw(String(cashDue))} />
              {[5000, 10000, 20000, 50000].map((v) => (
                <QuickCash key={v} label={`${v / 1000}`} onClick={() => setRaw(String(v))} />
              ))}
            </div>
            <Keypad onDigit={(d) => setRaw((r) => (r + d).slice(0, 8))} onBackspace={() => setRaw((r) => r.slice(0, -1))} onClear={() => setRaw("")} />
            <div className="flex items-center justify-between rounded-xl bg-sand px-4 py-3">
              <span className="font-bold text-[15px] text-ink">{t.caisse.tender.change}</span>
              <span className="font-display font-extrabold text-[24px] text-harissa-pressed tabular-nums" dir="ltr">{money(change)}</span>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted-soft font-semibold text-center py-2">
            {method === "card" ? t.caisse.tender.cardHint : t.caisse.tender.d17Hint}
          </p>
        )}

        {error && <p className="text-center text-[13px] font-bold text-danger-text">{error}</p>}

        <button
          type="button"
          onClick={confirm}
          disabled={!canConfirm || phase === "placing"}
          className="h-[54px] rounded-xl bg-harissa text-white font-extrabold text-[17px] flex items-center justify-center cursor-pointer hover:bg-harissa-pressed transition-colors disabled:bg-disabled disabled:cursor-not-allowed"
        >
          {phase === "placing" ? t.caisse.tender.submitting : t.caisse.tender.submit}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label={t.caisse.common.close} className="absolute inset-0 bg-ink/50 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[420px] max-h-[92dvh] overflow-y-auto bg-cream rounded-2xl shadow-[0_20px_60px_rgba(34,26,19,0.4)]">
        {children}
      </div>
    </div>
  );
}

function QuickCash({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex-1 h-11 rounded-lg bg-white border border-line-strong font-extrabold text-[14px] text-ink tabular-nums cursor-pointer hover:border-harissa transition-colors">
      {label}
    </button>
  );
}

function Keypad({ onDigit, onBackspace, onClear }: { onDigit: (d: string) => void; onBackspace: () => void; onClear: () => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <KeypadBtn key={d} onClick={() => onDigit(d)}>{d}</KeypadBtn>
      ))}
      <KeypadBtn onClick={onClear}><span className="text-[15px]">C</span></KeypadBtn>
      <KeypadBtn onClick={() => onDigit("0")}>0</KeypadBtn>
      <KeypadBtn onClick={onBackspace}><span className="text-[18px]">⌫</span></KeypadBtn>
    </div>
  );
}

function KeypadBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-12 rounded-lg bg-white border border-line-strong font-extrabold text-[18px] text-ink cursor-pointer active:bg-sand transition-colors">
      {children}
    </button>
  );
}
