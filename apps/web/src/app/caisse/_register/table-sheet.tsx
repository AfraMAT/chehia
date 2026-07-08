"use client";

import { useI18n } from "@/components/i18n-provider";
import { useCaisse } from "../caisse-provider";

/** Pick the destination table for a dine-in (sur place) order. */
export function TableSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { tables, serviceTable, table, setTable } = useCaisse();
  const dineInTables = tables.filter((t) => t.id !== serviceTable?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label="Fermer" className="absolute inset-0 bg-ink/50 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[440px] max-h-[86dvh] bg-cream rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(34,26,19,0.4)]">
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-line">
          <span className="font-display font-extrabold text-[18px] text-ink">{t.caisse.table.title}</span>
          <button type="button" onClick={onClose} aria-label={t.caisse.common.close} className="w-9 h-9 rounded-full bg-white border border-line text-ink font-extrabold cursor-pointer">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {dineInTables.length === 0 ? (
            <p className="text-center text-[13.5px] text-muted-soft font-semibold py-8">
              {t.caisse.table.empty}
            </p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
              {dineInTables.map((t) => {
                const active = table?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTable(t);
                      onClose();
                    }}
                    className={`h-16 rounded-xl border-[1.5px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                      active ? "border-harissa bg-harissa-tint" : "border-line-strong bg-white hover:border-harissa"
                    }`}
                  >
                    <span className={`font-extrabold text-[15px] ${active ? "text-harissa-pressed" : "text-ink"}`}>{t.label}</span>
                    {t.zone && <span className="text-[11px] font-semibold text-muted-soft">{t.zone}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
