"use client";

import { useEffect, useState } from "react";
import { formatQty, STOCK_CATEGORIES, STOCK_UNITS, type InventoryItem } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Spinner, Toggle } from "@/components/ui";
import { usePortal } from "../portal-provider";
import { ConfirmDialog } from "../confirm-dialog";
import { useInventoryCategory, useInventoryUnit } from "./unit-label";

function parseDecimal(value: string): number | null {
  const trimmed = value.replace(",", ".").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Create / edit a stock product. Quantity is edited via movements, not here. */
export function InventoryEditor({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { restaurant } = usePortal();
  const { t, lang } = useI18n();
  const supabase = getSupabase();
  const unitLabel = useInventoryUnit();
  const categoryLabel = useInventoryCategory();
  const inv = t.portal.inventory;

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "other");
  const [unit, setUnit] = useState(item?.unit ?? "piece");
  const [openingQty, setOpeningQty] = useState("");
  const [threshold, setThreshold] = useState(item ? String(item.reorder_threshold) : "");
  const [par, setPar] = useState(item?.par_level != null ? String(item.par_level) : "");
  const [cost, setCost] = useState(item?.unit_cost_millimes ? (item.unit_cost_millimes / 1000).toFixed(3) : "");
  const [supplierName, setSupplierName] = useState(item?.supplier_name ?? "");
  const [supplierPhone, setSupplierPhone] = useState(item?.supplier_phone ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [track, setTrack] = useState(item?.track ?? true);
  const [auto86, setAuto86] = useState(item?.auto_86 ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Include a custom (non-suggested) unit so editing preserves it.
  const unitOptions = STOCK_UNITS.includes(unit as (typeof STOCK_UNITS)[number])
    ? [...STOCK_UNITS]
    : [unit, ...STOCK_UNITS];

  const save = async () => {
    if (!name.trim()) {
      setError(inv.name);
      return;
    }
    setSaving(true);
    setError(null);
    const thresholdNum = parseDecimal(threshold) ?? 0;
    const parNum = parseDecimal(par);
    const costMillimes = cost.trim() === "" ? null : Math.round((parseDecimal(cost) ?? 0) * 1000);
    const payload = {
      name: name.trim(),
      category,
      unit,
      reorder_threshold: Math.max(0, thresholdNum),
      par_level: parNum != null ? Math.max(0, parNum) : null,
      unit_cost_millimes: costMillimes,
      supplier_name: supplierName.trim(),
      supplier_phone: supplierPhone.trim(),
      note: note.trim(),
      track,
      auto_86: auto86,
    };
    try {
      if (item) {
        const { error: e } = await supabase.from("inventory_items").update(payload).eq("id", item.id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from("inventory_items")
          .insert({ ...payload, restaurant_id: restaurant.id })
          .select("id")
          .single();
        if (e || !data) throw e ?? new Error("insert failed");
        // Opening balance as an audited 'count' movement.
        const opening = parseDecimal(openingQty);
        if (opening != null && opening > 0) {
          await supabase.rpc("set_stock_count", {
            p_item_id: (data as { id: string }).id,
            p_new_qty: opening,
            p_reason: inv.newProduct,
          });
        }
      }
      onSaved();
    } catch {
      setError(t.errors.generic);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    setConfirmingDelete(false);
    const { error: e } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (e) {
      setError(t.errors.generic);
      return;
    }
    onSaved();
  };

  const inputClass =
    "h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item ? inv.editProduct : inv.newProduct}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] max-h-[90dvh] overflow-y-auto bg-card border border-line rounded-2xl shadow-xl p-5 flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between">
          <span className="font-display font-extrabold text-lg text-ink">{item ? inv.editProduct : inv.newProduct}</span>
          <button type="button" aria-label={t.common.close} onClick={onClose} className="text-muted-soft font-extrabold cursor-pointer">
            ✕
          </button>
        </div>

        <Field label={inv.name}>
          <input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="flex gap-2.5">
          <Field label={inv.category} className="flex-1">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={inv.unit} className="flex-1">
            <select className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex gap-2.5">
          {!item ? (
            <Field label={inv.onHand} className="flex-1">
              <input inputMode="decimal" dir="ltr" className={inputClass} value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} />
            </Field>
          ) : (
            <Field label={inv.onHand} className="flex-1">
              <div className="h-11 flex items-center px-3.5 rounded-md bg-sand text-sm font-extrabold text-ink tabular-nums" dir="ltr">
                {formatQty(item.qty_on_hand, lang)} {unitLabel(item.unit)}
              </div>
            </Field>
          )}
          <Field label={inv.threshold} className="flex-1">
            <input inputMode="decimal" dir="ltr" className={inputClass} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-2.5">
          <Field label={inv.par} className="flex-1">
            <input inputMode="decimal" dir="ltr" className={inputClass} value={par} onChange={(e) => setPar(e.target.value)} />
          </Field>
          <Field label={inv.unitCost} className="flex-1">
            <input inputMode="decimal" dir="ltr" className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-2.5">
          <Field label={inv.supplier} className="flex-1">
            <input className={inputClass} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </Field>
          <Field label={inv.supplierPhone} className="flex-1">
            <input className={inputClass} dir="ltr" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
          </Field>
        </div>

        <Field label={inv.note}>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="flex items-start justify-between gap-3 pt-2 border-t border-line">
          <div className="flex flex-col gap-0.5 flex-1">
            <span className="text-[13px] font-extrabold text-ink">{inv.track}</span>
            <span className="text-[11.5px] text-muted leading-relaxed">{inv.trackHint}</span>
          </div>
          <Toggle checked={track} onChange={setTrack} label={inv.track} />
        </div>

        <div className="flex items-start justify-between gap-3 pt-2 border-t border-line">
          <div className="flex flex-col gap-0.5 flex-1">
            <span className="text-[13px] font-extrabold text-ink">{inv.auto86}</span>
            <span className="text-[11.5px] text-muted leading-relaxed">{inv.auto86Hint}</span>
          </div>
          <Toggle checked={auto86} onChange={setAuto86} label={inv.auto86} />
        </div>

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
            onClick={() => void save()}
            disabled={saving}
            className="flex-[1.6] h-11 rounded-lg bg-harissa text-white font-extrabold text-sm cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Spinner className="w-4 h-4" /> : inv.save}
          </button>
        </div>

        {item && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="h-9 rounded-md text-danger-text font-bold text-[12.5px] hover:bg-danger-tint transition-colors cursor-pointer"
          >
            {inv.deleteProduct}
          </button>
        )}

        {confirmingDelete && (
          <ConfirmDialog
            body={inv.deleteConfirm}
            confirmLabel={inv.deleteProduct}
            onConfirm={() => void remove()}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{label}</span>
      {children}
    </div>
  );
}
