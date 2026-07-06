"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatQty,
  interpolate,
  millimesToDisplay,
  suggestReorderQty,
  type InventoryItem,
  type InventoryOverview,
  type StockLevel,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { SearchIcon, Skeleton, Spinner } from "@/components/ui";
import { usePortal } from "../portal-provider";
import { InventoryEditor } from "./inventory-editor";
import { MovementDialog, type MovementAction } from "./movement-dialog";
import { HistorySheet } from "./history-sheet";
import { useInventoryCategory, useInventoryUnit } from "./unit-label";

type Filter = "all" | "low" | "out";

const LEVEL_STYLE: Record<StockLevel, { chip: string; dot: string }> = {
  ok: { chip: "bg-success-tint text-success-text", dot: "bg-success" },
  low: { chip: "bg-warning-tint text-warning-text", dot: "bg-warning" },
  out: { chip: "bg-danger-tint text-danger-text", dot: "bg-danger" },
};

/** Stock management board: products, status, quick movements, alerts. */
export default function InventoryPage() {
  const { restaurant, canManage } = usePortal();
  const { t, lang } = useI18n();
  const supabase = getSupabase();
  const unitLabel = useInventoryUnit();
  const categoryLabel = useInventoryCategory();
  const inv = t.portal.inventory;

  const [data, setData] = useState<InventoryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [movement, setMovement] = useState<{ item: InventoryItem; action: MovementAction } | null>(null);
  const [history, setHistory] = useState<InventoryItem | null>(null);

  const reload = useCallback(async () => {
    const { data: rpc } = await supabase.rpc("inventory_overview", { p_restaurant_id: restaurant.id });
    setData((rpc as InventoryOverview | null) ?? { summary: { total: 0, ok: 0, low: 0, out: 0, value_millimes: 0 }, items: [] });
    setLoading(false);
  }, [restaurant.id, supabase]);

  // On open: refresh alert state (catches threshold edits / items that drifted
  // low without a movement), then load. Owner/manager only — the RPC guards it.
  useEffect(() => {
    void (async () => {
      if (canManage) await supabase.rpc("sync_stock_alerts", { p_restaurant_id: restaurant.id });
      await reload();
    })();
  }, [canManage, reload, restaurant.id, supabase]);

  // Live board: any stock change (order depletion, another operator) refreshes.
  useEffect(() => {
    const channel = supabase
      .channel(`inventory-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items", filter: `restaurant_id=eq.${restaurant.id}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, reload, supabase]);

  const runCheck = async () => {
    setChecking(true);
    await supabase.rpc("sync_stock_alerts", { p_restaurant_id: restaurant.id });
    await reload();
    setChecking(false);
    setChecked(true);
    setTimeout(() => setChecked(false), 2000);
  };

  const items = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "low" && it.level !== "low") return false;
      if (filter === "out" && it.level !== "out") return false;
      if (q && !it.name.toLowerCase().includes(q) && !categoryLabel(it.category).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, query, categoryLabel]);

  const summary = data?.summary;

  const afterWrite = () => {
    setMovement(null);
    setEditing(null);
    setCreating(false);
    void reload();
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="flex flex-wrap items-center gap-3 px-6 pt-5 pb-2">
        <h1 className="font-display font-extrabold text-2xl text-ink">{inv.title}</h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={checking || !canManage}
          className="h-10 px-4 rounded-lg border-[1.5px] border-line-strong text-ink font-extrabold text-[13px] cursor-pointer hover:bg-sand transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {checking ? <Spinner className="w-4 h-4" /> : checked ? `✓ ${inv.checked}` : inv.runCheck}
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-10 px-4 rounded-lg bg-harissa text-white font-extrabold text-[13px] cursor-pointer hover:bg-harissa-pressed transition-colors"
          >
            {inv.add}
          </button>
        )}
      </div>
      <p className="px-6 mb-3 text-sm text-muted">{inv.subtitle}</p>

      {loading ? (
        <div className="px-6 flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-6 pb-8">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard value={summary?.total ?? 0} label={inv.items} />
            <SummaryCard value={summary?.low ?? 0} label={inv.low} tone="low" />
            <SummaryCard value={summary?.out ?? 0} label={inv.out} tone="out" />
            <SummaryCard value={millimesToDisplay(summary?.value_millimes ?? 0, lang)} label={inv.stockValue} suffix="TND" />
          </div>

          {items.length === 0 ? (
            <div className="mx-0 bg-card border border-line rounded-2xl p-10 flex flex-col items-center gap-2 text-center">
              <span className="font-display font-extrabold text-xl text-ink">{inv.empty}</span>
              <span className="text-sm text-muted max-w-[420px]">{inv.emptyBody}</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-3 h-11 px-5 rounded-lg bg-harissa text-white font-extrabold text-sm cursor-pointer"
                >
                  {inv.add}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-soft">
                    <SearchIcon />
                  </span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={inv.search}
                    className="h-10 w-full rounded-lg border-[1.5px] border-line-strong bg-white ps-9 pe-3 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors"
                  />
                </div>
                <div className="flex gap-1.5" dir="ltr">
                  {(["all", "low", "out"] as const).map((f) => {
                    const label = f === "all" ? inv.filterAll : f === "low" ? inv.filterLow : inv.filterOut;
                    const count = f === "all" ? undefined : f === "low" ? summary?.low : summary?.out;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`h-10 px-3.5 rounded-lg font-extrabold text-[13px] cursor-pointer transition-colors ${
                          filter === f ? "bg-ink text-cream" : "border-[1.5px] border-line-strong text-muted hover:bg-sand"
                        }`}
                      >
                        {label}
                        {count ? ` · ${count}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product list */}
              {filtered.length === 0 ? (
                <div className="bg-card border border-line rounded-2xl p-8 text-center text-sm text-muted">{inv.noResults}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map((it) => {
                    const style = LEVEL_STYLE[it.level];
                    const reorder = suggestReorderQty(it);
                    return (
                      <div
                        key={it.id}
                        className="bg-card border border-line rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
                      >
                        {/* Name + category */}
                        <div className="flex flex-col min-w-[150px] flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[14.5px] text-ink truncate">{it.name}</span>
                            {!it.track && (
                              <span className="text-[10px] font-bold text-muted-soft bg-sand rounded-full px-2 py-0.5">
                                {inv.track}: —
                              </span>
                            )}
                          </div>
                          <span className="text-[11.5px] font-semibold text-muted-soft">
                            {categoryLabel(it.category)}
                            {it.linked_items > 0 && ` · ${interpolate(inv.usedIn, { n: it.linked_items })}`}
                          </span>
                        </div>

                        {/* On hand */}
                        <div className="flex flex-col items-end min-w-[86px]" dir="ltr">
                          <span className={`text-[16px] font-extrabold tabular-nums ${it.level === "out" ? "text-danger-text" : "text-ink"}`}>
                            {formatQty(it.qty_on_hand, lang)}
                          </span>
                          <span className="text-[11px] font-semibold text-muted-soft">{unitLabel(it.unit)}</span>
                        </div>

                        {/* Status + threshold + reorder hint */}
                        <div className="flex flex-col items-start gap-1 min-w-[130px]">
                          <span className={`inline-flex items-center gap-1.5 font-bold text-[11.5px] px-2.5 py-1 rounded-full ${style.chip}`}>
                            <span className={`w-[7px] h-[7px] rounded-full ${style.dot}`} />
                            {it.level === "ok" ? inv.levelOk : it.level === "low" ? inv.levelLow : inv.levelOut}
                          </span>
                          {it.level !== "ok" && reorder != null && reorder > 0 && (
                            <span className="text-[11px] font-bold text-muted-soft">
                              {interpolate(inv.reorderSuggest, { qty: formatQty(reorder, lang), unit: unitLabel(it.unit) })}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {canManage && (
                            <>
                              <ActionButton onClick={() => setMovement({ item: it, action: "receive" })} label={inv.receive} tone="primary" />
                              <ActionButton onClick={() => setMovement({ item: it, action: "count" })} label={inv.count} />
                              <ActionButton onClick={() => setMovement({ item: it, action: "waste" })} label={inv.waste} />
                            </>
                          )}
                          <ActionButton onClick={() => setHistory(it)} label={inv.history} />
                          {canManage && <ActionButton onClick={() => setEditing(it)} label={t.common.edit} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!canManage && <p className="text-[12px] text-muted-soft">{inv.manageOnly}</p>}
        </div>
      )}

      {creating && <InventoryEditor item={null} onClose={() => setCreating(false)} onSaved={afterWrite} />}
      {editing && <InventoryEditor item={editing} onClose={() => setEditing(null)} onSaved={afterWrite} />}
      {movement && (
        <MovementDialog item={movement.item} action={movement.action} onClose={() => setMovement(null)} onDone={afterWrite} />
      )}
      {history && <HistorySheet item={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function SummaryCard({
  value,
  label,
  tone,
  suffix,
}: {
  value: number | string;
  label: string;
  tone?: "low" | "out";
  suffix?: string;
}) {
  const color = tone === "out" ? "text-danger-text" : tone === "low" ? "text-warning-text" : "text-ink";
  return (
    <div className="bg-card border border-line rounded-2xl p-4 flex flex-col gap-0.5">
      <span className={`font-display font-extrabold text-[28px] leading-none tabular-nums ${color}`}>
        {value}
        {suffix && <span className="text-[13px] font-bold text-muted-soft ms-1">{suffix}</span>}
      </span>
      <span className="text-[12px] font-semibold text-muted-soft">{label}</span>
    </div>
  );
}

function ActionButton({ onClick, label, tone }: { onClick: () => void; label: string; tone?: "primary" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-md font-extrabold text-[12px] cursor-pointer transition-colors ${
        tone === "primary"
          ? "bg-harissa-tint text-harissa-pressed hover:bg-[#F2DCCE]"
          : "border-[1.5px] border-line-strong text-muted hover:bg-sand"
      }`}
    >
      {label}
    </button>
  );
}
