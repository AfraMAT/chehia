"use client";

import { useEffect, useMemo, useState } from "react";
import { buildLine, formatDelta, validateModifiers, type MenuItem } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse } from "../caisse-provider";
import { money, txt } from "./util";

/**
 * Compact modifier picker for the register. Mirrors the customer item sheet's
 * rules (single vs multi, required min/max) but tuned for fast counter taps.
 */
export function ModifierSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { t } = useI18n();
  const { groupsByItem, addToTicket } = useCaisse();
  const groups = useMemo(
    () => [...(groupsByItem[item.id] ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [groupsByItem, item.id],
  );
  const [selected, setSelected] = useState<string[]>(() =>
    groups.filter((g) => g.min_select >= 1 && g.max_select === 1 && g.modifiers[0]).map((g) => g.modifiers[0]!.id),
  );
  const [qty, setQty] = useState(1);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validation = validateModifiers(groups, selected);
  const line = buildLine(item, groups, selected, qty);

  const toggle = (groupId: string, modId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelected((prev) => {
      const inGroup = group.modifiers.map((m) => m.id);
      if (group.max_select === 1) {
        const cleared = prev.filter((id) => !inGroup.includes(id));
        return prev.includes(modId) && group.min_select === 0 ? cleared : [...cleared, modId];
      }
      if (prev.includes(modId)) return prev.filter((id) => id !== modId);
      if (prev.filter((id) => inGroup.includes(id)).length >= group.max_select) return prev;
      return [...prev, modId];
    });
  };

  const submit = () => {
    setTouched(true);
    if (!validation.ok) return;
    addToTicket(buildLine(item, groups, selected, qty));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label={t.caisse.common.close} className="absolute inset-0 bg-ink/45 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[460px] max-h-[88dvh] bg-cream rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(34,26,19,0.35)]">
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <div className="flex flex-col">
            <h2 className="font-display font-extrabold text-[20px] leading-tight text-ink">{txt(item.name_i18n)}</h2>
            <span className="text-[13px] font-bold text-muted tabular-nums" dir="ltr">{money(item.price_millimes)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.caisse.common.close}
            className="w-9 h-9 rounded-full bg-white border border-line text-ink font-extrabold flex items-center justify-center cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {groups.map((group) => {
            const required = group.min_select >= 1;
            const missing = touched && validation.missingGroups.includes(group.id);
            return (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-extrabold text-[13.5px] text-ink">
                    {txt(group.name_i18n)}
                    {!required && <span className="font-semibold text-[11.5px] text-muted-soft"> · {t.caisse.modifier.optional}</span>}
                  </span>
                  {required && (
                    <span className={`text-[10.5px] font-bold rounded-full px-2 py-0.5 ${missing ? "bg-danger-tint text-danger-text" : "bg-harissa-tint text-harissa-pressed"}`}>
                      {t.caisse.modifier.required}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.modifiers.map((mod) => {
                    const active = selected.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggle(group.id, mod.id)}
                        className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border-[1.5px] text-[13px] font-bold cursor-pointer transition-colors ${
                          active ? "border-harissa bg-harissa-tint text-harissa-pressed" : "border-line-strong bg-white text-ink"
                        }`}
                      >
                        {txt(mod.name_i18n)}
                        {mod.price_delta_millimes !== 0 && (
                          <span className={`text-[11px] ${active ? "text-harissa-pressed" : "text-muted-soft"}`} dir="ltr">
                            {formatDelta(mod.price_delta_millimes, "fr")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {touched && !validation.ok && <p className="text-[12.5px] font-bold text-danger-text">{t.caisse.modifier.chooseRequired}</p>}
        </div>

        <div className="shrink-0 flex gap-3 px-4 py-3 bg-card border-t border-line items-center">
          <div className="flex items-center rounded-lg border-[1.5px] border-line-strong bg-white h-[50px]">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 h-full text-xl font-extrabold text-ink cursor-pointer" aria-label={t.caisse.common.decrease}>−</button>
            <span className="w-8 text-center font-extrabold text-ink tabular-nums">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="w-11 h-full text-xl font-extrabold text-ink cursor-pointer" aria-label={t.caisse.common.increase}>+</button>
          </div>
          <button
            type="button"
            onClick={submit}
            className="flex-1 h-[50px] rounded-xl bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center gap-2 hover:bg-harissa-pressed transition-colors cursor-pointer"
          >
            {t.caisse.modifier.add} · <span dir="ltr" className="tabular-nums">{money(line.unitPriceMillimes * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
