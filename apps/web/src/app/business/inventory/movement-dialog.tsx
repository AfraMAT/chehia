"use client";

import { useEffect, useMemo, useState } from "react";
import { formatQty, type InventoryItem } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/ui";
import { useInventoryUnit } from "./unit-label";

export type MovementAction = "receive" | "waste" | "count" | "adjust";

/** Parse a decimal typed with comma or dot; returns null when invalid. */
function parseDecimal(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * One stock movement for a single product: receive (add), waste (remove),
 * count (set to a counted value), or adjust (signed correction). Shows a live
 * preview of the resulting on-hand and calls the guarded RPC.
 */
export function MovementDialog({
  item,
  action,
  onClose,
  onDone,
}: {
  item: InventoryItem;
  action: MovementAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const unitLabel = useInventoryUnit();
  const supabase = getSupabase();
  const inv = t.portal.inventory;

  const [qty, setQty] = useState(action === "count" ? formatQty(item.qty_on_hand, lang) : "");
  const [cost, setCost] = useState(
    item.unit_cost_millimes ? (item.unit_cost_millimes / 1000).toFixed(3) : "",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = {
    receive: inv.receiveTitle,
    waste: inv.wasteTitle,
    count: inv.countTitle,
    adjust: inv.adjustTitle,
  }[action];

  const qtyLabel = {
    receive: inv.qtyAdd,
    waste: inv.qtyRemove,
    count: inv.newQty,
    adjust: inv.adjustQty,
  }[action];

  const parsed = parseDecimal(qty);
  const preview = useMemo(() => {
    if (parsed === null) return null;
    switch (action) {
      case "receive":
        return item.qty_on_hand + Math.abs(parsed);
      case "waste":
        return item.qty_on_hand - Math.abs(parsed);
      case "adjust":
        return item.qty_on_hand + parsed;
      case "count":
        return parsed;
    }
  }, [action, parsed, item.qty_on_hand]);

  const valid =
    parsed !== null &&
    (action === "adjust" ? parsed !== 0 : action === "count" ? parsed >= 0 : parsed > 0);

  const submit = async () => {
    if (!valid || parsed === null) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "count") {
        const { error: e } = await supabase.rpc("set_stock_count", {
          p_item_id: item.id,
          p_new_qty: parsed,
          p_reason: reason,
        });
        if (e) throw e;
      } else {
        const type = action === "adjust" ? "adjustment" : action;
        const costMillimes =
          action === "receive" && cost.trim() !== ""
            ? Math.round((parseDecimal(cost) ?? 0) * 1000)
            : null;
        const { error: e } = await supabase.rpc("record_stock_movement", {
          p_item_id: item.id,
          p_type: type,
          p_qty: parsed,
          p_reason: reason,
          p_unit_cost: costMillimes,
        });
        if (e) throw e;
      }
      onDone();
    } catch {
      setError(t.errors.generic);
      setBusy(false);
    }
  };

  const inputClass =
    "h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-card border border-line rounded-2xl shadow-xl p-5 flex flex-col gap-3.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-display font-extrabold text-lg text-ink">{title}</span>
            <span className="text-[13px] font-bold text-muted-soft">
              {item.name} · {formatQty(item.qty_on_hand, lang)} {unitLabel(item.unit)}
            </span>
          </div>
          <button type="button" aria-label={t.common.close} onClick={onClose} className="text-muted-soft font-extrabold cursor-pointer">
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{qtyLabel}</span>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              inputMode="decimal"
              dir="ltr"
              className={inputClass}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <span className="text-[13px] font-bold text-muted-soft shrink-0 min-w-10">{unitLabel(item.unit)}</span>
          </div>
        </label>

        {action === "receive" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{inv.unitCost}</span>
            <input inputMode="decimal" dir="ltr" className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{inv.reason}</span>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {preview !== null && (
          <div className="flex items-center justify-between bg-sand rounded-lg px-3.5 py-2.5">
            <span className="text-[12.5px] font-bold text-muted">{inv.onHand}</span>
            <span
              className={`text-[15px] font-extrabold tabular-nums ${preview <= 0 ? "text-danger-text" : "text-ink"}`}
            >
              {formatQty(preview, lang)} {unitLabel(item.unit)}
            </span>
          </div>
        )}

        {error && <p className="text-[12.5px] font-bold text-danger-text">{error}</p>}

        <div className="flex gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border-[1.5px] border-line-strong text-muted font-extrabold text-sm cursor-pointer hover:bg-sand transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || busy}
            className="flex-1 h-11 rounded-lg bg-harissa text-white font-extrabold text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Spinner className="w-4 h-4" /> : inv.save}
          </button>
        </div>
      </div>
    </div>
  );
}
