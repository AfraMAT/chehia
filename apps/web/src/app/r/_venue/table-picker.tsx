"use client";

import { useI18n } from "@/components/i18n-provider";
import { useVenue, type TableChoice } from "./venue-provider";

/**
 * Bottom sheet to choose a table in the browse flow (app.chehia.app). Groups
 * the venue's tables by zone. Selecting one attaches it to the cart (no
 * qr_token needed — the order is placed by table_id).
 */
export function TablePicker({ onClose }: { onClose: () => void }) {
  const { tables, setTable, table } = useVenue();
  const { t } = useI18n();

  const byZone = new Map<string, TableChoice[]>();
  for (const tb of tables ?? []) {
    const zone = tb.zone || "";
    (byZone.get(zone) ?? byZone.set(zone, []).get(zone)!).push(tb);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label={t.common.close} className="absolute inset-0 bg-ink/45 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[520px] max-h-[86dvh] bg-cream rounded-t-3xl flex flex-col overflow-hidden shadow-[0_-12px_40px_rgba(34,26,19,0.3)]">
        <div className="shrink-0 px-5 pt-3 pb-2">
          <div className="w-11 h-[5px] rounded bg-line-strong mx-auto mb-3.5" />
          <h2 className="font-display font-extrabold text-[22px] text-ink">{t.landing.tablePickerTitle}</h2>
          <p className="text-[13px] text-muted">{t.landing.tablePickerBody}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-6 flex flex-col gap-4">
          {(tables ?? []).length === 0 && (
            <p className="py-10 text-center text-sm font-semibold text-muted">{t.landing.noTables}</p>
          )}
          {[...byZone.entries()].map(([zone, list]) => (
            <div key={zone || "_"} className="flex flex-col gap-2">
              {zone && (
                <span className="text-xs font-bold text-muted-soft tracking-wide uppercase">{zone}</span>
              )}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {list.map((tb) => {
                  const active = table?.id === tb.id;
                  return (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => {
                        setTable(tb);
                        onClose();
                      }}
                      className={`h-14 rounded-xl font-display font-extrabold text-lg flex items-center justify-center transition-colors cursor-pointer border-[1.5px] ${
                        active
                          ? "bg-ink text-cream border-ink"
                          : "bg-white border-line-strong text-ink hover:border-harissa hover:text-harissa-pressed"
                      }`}
                      aria-label={`${t.common.table} ${tb.label}`}
                    >
                      {tb.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
