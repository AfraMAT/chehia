"use client";

import { useEffect, useState } from "react";
import { formatQty, formatRelativeTime, type InventoryItem, type MovementType, type StockMovement } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Skeleton } from "@/components/ui";
import { useInventoryUnit } from "./unit-label";

/** Read-only ledger for one product: every movement, newest first. */
export function HistorySheet({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { t, lang } = useI18n();
  const unitLabel = useInventoryUnit();
  const inv = t.portal.inventory;

  const [rows, setRows] = useState<StockMovement[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await getSupabase().rpc("stock_movements_list", { p_item_id: item.id, p_limit: 100 });
      if (alive) setRows((data as StockMovement[] | null) ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [item.id]);

  const movementLabel = (type: MovementType) =>
    (inv.movement as Record<string, string>)[type] ?? type;

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={inv.historyTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[85dvh] bg-card border border-line rounded-2xl shadow-xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-line">
          <div className="flex flex-col gap-0.5">
            <span className="font-display font-extrabold text-lg text-ink">{inv.historyTitle}</span>
            <span className="text-[13px] font-bold text-muted-soft">{item.name}</span>
          </div>
          <button type="button" aria-label={t.common.close} onClick={onClose} className="text-muted-soft font-extrabold cursor-pointer">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-3 flex flex-col gap-2">
          {rows === null ? (
            <>
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">{inv.noMovements}</p>
          ) : (
            rows.map((m) => {
              const positive = m.qty_delta > 0;
              return (
                <div key={m.id} className="flex items-center gap-3 border border-line rounded-xl px-3.5 py-2.5">
                  <span
                    className={`text-[15px] font-extrabold tabular-nums shrink-0 w-16 text-end ${
                      positive ? "text-success-text" : "text-danger-text"
                    }`}
                    dir="ltr"
                  >
                    {positive ? "+" : ""}
                    {formatQty(m.qty_delta, lang)}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13.5px] font-bold text-ink">{movementLabel(m.type)}</span>
                    {m.reason && <span className="text-[12px] text-muted-soft truncate">{m.reason}</span>}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[12.5px] font-bold text-muted tabular-nums">
                      → {formatQty(m.qty_after, lang)} {unitLabel(item.unit)}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-soft">
                      {formatRelativeTime(m.created_at, lang)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
