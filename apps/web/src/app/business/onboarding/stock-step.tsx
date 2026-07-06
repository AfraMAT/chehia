"use client";

import { useCallback, useEffect, useState } from "react";
import { STOCK_UNITS, tr } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Spinner, Toggle } from "@/components/ui";
import { usePortal } from "../portal-provider";
import { useInventoryUnit } from "../inventory/unit-label";

/** "5,5" / "5.5" → number, or null. Empty → 0. Negatives rejected. */
function num(v: string): number | null {
  const t = v.replace(",", ".").trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

interface Dish {
  id: string;
  name: string;
}
interface DishState {
  tracked: boolean;
  invId: string | null;
  linkId: string | null;
  opening: string;
  threshold: string;
  qty: number; // current on-hand (dirty check)
  savedThreshold: number; // last-persisted threshold (dirty check)
  busy: boolean;
}
interface Standalone {
  id: string;
  name: string;
  unit: string;
  qty: number;
  threshold: number;
}

const DEFAULT_THRESHOLD = "5";
// Provenance markers (see migration 20260708000002): the wizard only ever
// edits/deletes products it created, never a real ingredient (source NULL).
const SRC_DISH = "onboarding_dish";
const SRC_INGREDIENT = "onboarding";

/**
 * Optional onboarding step: connect the just-listed dishes to stock. Toggling a
 * dish ON creates a "piece"-unit product (source='onboarding_dish') named after
 * the dish + an item_ingredients link (qty_per_unit 1) so every sale deducts
 * one. The opening balance is applied via set_stock_count while the threshold is
 * 0 (then the real threshold is set via a plain update + last_alert_level reset)
 * so setup never raises a stock alert. Everything here is keyed on the `source`
 * marker, so a real shared ingredient is never touched.
 */
export function StockStep() {
  const { t, lang } = useI18n();
  const { restaurant } = usePortal();
  const supabase = getSupabase();
  const unitLabel = useInventoryUnit();
  const o = t.onboarding;

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [rows, setRows] = useState<Record<string, DishState>>({});
  const [standalones, setStandalones] = useState<Standalone[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showIngredient, setShowIngredient] = useState(false);

  const load = useCallback(async () => {
    const [{ data: items }, { data: links }, { data: invs }] = await Promise.all([
      supabase.from("items").select("id, name_i18n").eq("restaurant_id", restaurant.id).order("sort_order"),
      supabase.from("item_ingredients").select("id, item_id, inventory_item_id").eq("restaurant_id", restaurant.id),
      supabase.from("inventory_items").select("id, name, unit, qty_on_hand, reorder_threshold, source").eq("restaurant_id", restaurant.id).eq("is_active", true),
    ]);
    const invById = new Map((invs ?? []).map((i) => [i.id as string, i]));
    const linkRows = (links ?? []) as { id: string; item_id: string; inventory_item_id: string }[];

    const dishList: Dish[] = (items ?? []).map((i) => ({ id: i.id as string, name: tr(i.name_i18n as Record<string, string>, lang) }));
    const nextRows: Record<string, DishState> = {};
    for (const d of dishList) {
      // Tracked iff this dish links to a product THIS wizard created for it.
      const link = linkRows.find((l) => {
        const inv = invById.get(l.inventory_item_id);
        return l.item_id === d.id && inv?.source === SRC_DISH;
      });
      const inv = link ? invById.get(link.inventory_item_id) : null;
      const qty = inv ? Number(inv.qty_on_hand) : 0;
      const thr = inv ? Number(inv.reorder_threshold) : Number(DEFAULT_THRESHOLD);
      nextRows[d.id] = {
        tracked: !!link,
        invId: inv?.id ?? null,
        linkId: link?.id ?? null,
        opening: inv ? String(qty) : "",
        threshold: inv ? String(thr) : DEFAULT_THRESHOLD,
        qty,
        savedThreshold: thr,
        busy: false,
      };
    }

    // Standalone list = only ingredients THIS wizard added (never real products).
    const standaloneList: Standalone[] = (invs ?? [])
      .filter((i) => i.source === SRC_INGREDIENT)
      .map((i) => ({
        id: i.id as string,
        name: i.name as string,
        unit: i.unit as string,
        qty: Number(i.qty_on_hand),
        threshold: Number(i.reorder_threshold),
      }));

    setDishes(dishList);
    setRows(nextRows);
    setStandalones(standaloneList);
    setLoaded(true);
  }, [restaurant.id, supabase, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (dishId: string, p: Partial<DishState>) => setRows((prev) => ({ ...prev, [dishId]: { ...prev[dishId], ...p } }));

  /** Apply an opening balance (>0 only, audited) + threshold, alert-free. */
  const applyBalance = async (invId: string, openingNum: number, thresholdNum: number) => {
    // Count under threshold 0 so opening>0 stays 'ok' (no alert). Zero/empty is
    // left as-is — we never write qty_on_hand outside the audited count path.
    if (openingNum > 0) {
      await supabase.from("inventory_items").update({ reorder_threshold: 0 }).eq("id", invId);
      await supabase.rpc("set_stock_count", { p_item_id: invId, p_new_qty: openingNum, p_reason: o.stockOpeningReason });
    }
    await supabase.from("inventory_items").update({ reorder_threshold: thresholdNum, last_alert_level: "ok" }).eq("id", invId);
  };

  const toggleDish = async (dish: Dish, on: boolean) => {
    const row = rows[dish.id];
    if (row.busy) return;
    patch(dish.id, { busy: true });
    if (on) {
      const { data: inv, error } = await supabase
        .from("inventory_items")
        .insert({ restaurant_id: restaurant.id, name: dish.name, category: "food", unit: "piece", reorder_threshold: 0, track: true, source: SRC_DISH })
        .select("id")
        .single();
      if (error || !inv) {
        patch(dish.id, { busy: false });
        return;
      }
      const invId = inv.id as string;
      const { data: linkRow, error: linkErr } = await supabase
        .from("item_ingredients")
        .insert({ restaurant_id: restaurant.id, item_id: dish.id, inventory_item_id: invId, qty_per_unit: 1 })
        .select("id")
        .single();
      if (linkErr) {
        // Unique violation → a link already existed; reload to reconcile.
        await supabase.from("inventory_items").delete().eq("id", invId).eq("source", SRC_DISH);
        await load();
        return;
      }
      const openingNum = num(row.opening) ?? 0;
      const thresholdNum = num(row.threshold) ?? 0;
      await applyBalance(invId, openingNum, thresholdNum);
      patch(dish.id, { tracked: true, invId, linkId: (linkRow?.id as string) ?? null, qty: openingNum, savedThreshold: thresholdNum, busy: false });
    } else {
      // Untrack: drop the link and the product WE created (source guard, so a
      // real ingredient is never deleted). Movements cascade on delete.
      if (row.linkId) await supabase.from("item_ingredients").delete().eq("id", row.linkId);
      if (row.invId) await supabase.from("inventory_items").delete().eq("id", row.invId).eq("source", SRC_DISH);
      patch(dish.id, { tracked: false, invId: null, linkId: null, opening: "", threshold: DEFAULT_THRESHOLD, qty: 0, savedThreshold: Number(DEFAULT_THRESHOLD), busy: false });
    }
  };

  const saveDishFields = async (dish: Dish) => {
    const row = rows[dish.id];
    if (!row.tracked || !row.invId) return;
    const openingNum = num(row.opening);
    const thresholdNum = num(row.threshold);
    if (openingNum === null || thresholdNum === null) return;
    const openingChanged = openingNum > 0 && openingNum !== row.qty;
    const thresholdChanged = thresholdNum !== row.savedThreshold;
    if (!openingChanged && !thresholdChanged) return; // nothing to persist
    patch(dish.id, { busy: true });
    if (openingChanged) {
      await applyBalance(row.invId, openingNum, thresholdNum);
      patch(dish.id, { qty: openingNum, savedThreshold: thresholdNum, busy: false });
    } else {
      // Threshold-only change: a plain update (no count, no flicker, no alert).
      await supabase.from("inventory_items").update({ reorder_threshold: thresholdNum, last_alert_level: "ok" }).eq("id", row.invId);
      patch(dish.id, { savedThreshold: thresholdNum, busy: false });
    }
  };

  const inputClass =
    "h-10 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="text-harissa" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="font-display font-extrabold text-lg text-ink">{o.stepStock}</span>
        <span className="text-[13px] text-muted leading-relaxed">{o.stepStockBody}</span>
      </div>

      {/* Section 1 — track dishes directly */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-extrabold text-ink uppercase tracking-wide">{o.stockTrackDishes}</span>
          <span className="text-[11.5px] text-muted-soft">{o.stockTrackHint}</span>
        </div>

        {dishes.length === 0 ? (
          <p className="text-[12.5px] font-bold text-muted-soft bg-sand rounded-lg px-3.5 py-3">{o.stockNoDishes}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dishes.map((dish) => {
              const row = rows[dish.id];
              return (
                <div key={dish.id} className="border border-line rounded-xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 font-extrabold text-[13.5px] text-ink truncate">{dish.name}</span>
                    {row.busy && <Spinner className="w-4 h-4 text-harissa" />}
                    <Toggle checked={row.tracked} onChange={(v) => void toggleDish(dish, v)} label={o.stockTrackDishes} disabled={row.busy} />
                  </div>
                  {row.tracked && (
                    <div className="flex items-end gap-2.5" dir="ltr">
                      <label className="flex flex-col gap-1 flex-1">
                        <span className="text-[10px] font-extrabold text-muted-soft tracking-wide uppercase">{o.stockOpening}</span>
                        <input
                          inputMode="decimal"
                          className={inputClass}
                          value={row.opening}
                          onChange={(e) => patch(dish.id, { opening: e.target.value })}
                          onBlur={() => void saveDishFields(dish)}
                        />
                      </label>
                      <label className="flex flex-col gap-1 flex-1">
                        <span className="text-[10px] font-extrabold text-muted-soft tracking-wide uppercase">{o.stockThreshold}</span>
                        <input
                          inputMode="decimal"
                          className={inputClass}
                          value={row.threshold}
                          onChange={(e) => patch(dish.id, { threshold: e.target.value })}
                          onBlur={() => void saveDishFields(dish)}
                        />
                      </label>
                      <span className="text-[11px] font-bold text-muted-soft pb-2.5">{unitLabel("piece")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2 — standalone ingredients / supplies */}
      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-extrabold text-ink uppercase tracking-wide">{o.stockIngredients}</span>
          <span className="text-[11.5px] text-muted-soft">{o.stockIngredientsHint}</span>
        </div>

        {standalones.map((s) => (
          <div key={s.id} className="flex items-center gap-3 bg-sand rounded-md px-3.5 py-2.5">
            <span className="flex-1 font-extrabold text-[13px] text-ink truncate">{s.name}</span>
            <span className="text-[12px] font-bold text-muted-soft tabular-nums" dir="ltr">
              {Number(s.qty)} {unitLabel(s.unit)}
            </span>
            <button
              type="button"
              onClick={() => {
                // Source guard: only remove ingredients this wizard created.
                void supabase
                  .from("inventory_items")
                  .delete()
                  .eq("id", s.id)
                  .eq("source", SRC_INGREDIENT)
                  .then(() => setStandalones((prev) => prev.filter((x) => x.id !== s.id)));
              }}
              className="text-[11.5px] font-bold text-muted hover:text-danger-text cursor-pointer"
            >
              {o.stockRemove}
            </button>
          </div>
        ))}

        {showIngredient ? (
          <IngredientForm
            onCancel={() => setShowIngredient(false)}
            onAdded={(s) => {
              setStandalones((prev) => [...prev, s]);
              setShowIngredient(false);
            }}
            applyBalance={applyBalance}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowIngredient(true)}
            className="self-start text-[12.5px] font-extrabold text-harissa-pressed hover:underline cursor-pointer"
          >
            {o.stockAddIngredient}
          </button>
        )}
      </div>

      <p className="text-[11.5px] text-muted-soft">{o.stockManageLater}</p>
    </div>
  );
}

function IngredientForm({
  onCancel,
  onAdded,
  applyBalance,
}: {
  onCancel: () => void;
  onAdded: (s: Standalone) => void;
  applyBalance: (invId: string, opening: number, threshold: number) => Promise<void>;
}) {
  const { t } = useI18n();
  const { restaurant } = usePortal();
  const supabase = getSupabase();
  const unitLabel = useInventoryUnit();
  const o = t.onboarding;
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("l");
  const [opening, setOpening] = useState("");
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const { data: inv, error } = await supabase
      .from("inventory_items")
      .insert({ restaurant_id: restaurant.id, name: name.trim(), category: "other", unit, reorder_threshold: 0, track: true, source: SRC_INGREDIENT })
      .select("id")
      .single();
    if (error || !inv) {
      setBusy(false);
      return;
    }
    const invId = inv.id as string;
    const openingNum = num(opening) ?? 0;
    const thresholdNum = num(threshold) ?? 0;
    await applyBalance(invId, openingNum, thresholdNum);
    onAdded({ id: invId, name: name.trim(), unit, qty: openingNum, threshold: thresholdNum });
  };

  const inp = "h-10 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa w-full";

  return (
    <div className="border border-line rounded-xl p-3 flex flex-col gap-2.5">
      <input className={inp} placeholder={o.stockIngredientName} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="flex gap-2" dir="ltr">
        <select className={`${inp} flex-1`} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {STOCK_UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel(u)}
            </option>
          ))}
        </select>
        <input inputMode="decimal" className={`${inp} w-24`} placeholder={o.stockOpening} value={opening} onChange={(e) => setOpening(e.target.value)} />
        <input inputMode="decimal" className={`${inp} w-24`} placeholder={o.stockThreshold} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-md border-[1.5px] border-line-strong text-muted font-extrabold text-[13px] cursor-pointer hover:bg-sand transition-colors"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || !name.trim()}
          className="flex-1 h-10 rounded-md bg-harissa text-white font-extrabold text-[13px] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? <Spinner className="w-4 h-4" /> : t.common.add}
        </button>
      </div>
    </div>
  );
}
