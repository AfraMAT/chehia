import type { Language } from "./types";

/**
 * Inventory / stock domain — shared by the business portal, the seed and
 * the edge functions. Pure helpers only; every rule here mirrors the SQL
 * (see supabase/migrations/20260708000001_inventory.sql) so the client and
 * the database never disagree about what "low stock" means.
 */

export type StockLevel = "ok" | "low" | "out";

export type MovementType = "receive" | "sale" | "waste" | "adjustment" | "count" | "cancel_return";

/** Movement types an operator can record by hand (order flow adds the rest). */
export const MANUAL_MOVEMENT_TYPES: MovementType[] = ["receive", "waste", "adjustment", "count"];

/** Display sign for a movement type: does it add, remove, or set stock? */
export const MOVEMENT_SIGN: Record<MovementType, "add" | "remove" | "set" | "signed"> = {
  receive: "add",
  sale: "remove",
  waste: "remove",
  adjustment: "signed",
  count: "set",
  cancel_return: "add",
};

/** Suggested unit codes (the field is free text; these seed the picker). */
export const STOCK_UNITS = [
  "piece",
  "portion",
  "kg",
  "g",
  "l",
  "ml",
  "bottle",
  "can",
  "pack",
  "box",
  "cup",
  "bag",
  "jar",
  "tray",
] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

/** Suggested inventory categories. */
export const STOCK_CATEGORIES = ["food", "drinks", "supplies", "other"] as const;
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

/**
 * The alert level for a quantity vs its reorder threshold. Identical to the
 * SQL `stock_level_of`:
 *   - untracked → always ok
 *   - qty ≤ 0 → out
 *   - threshold > 0 and qty ≤ threshold → low
 *   - otherwise → ok
 */
export function stockLevel(qty: number, threshold: number, track = true): StockLevel {
  if (!track) return "ok";
  if (qty <= 0) return "out";
  if (threshold > 0 && qty <= threshold) return "low";
  return "ok";
}

const LEVEL_RANK: Record<StockLevel, number> = { ok: 0, low: 1, out: 2 };
export function stockLevelRank(level: StockLevel): number {
  return LEVEL_RANK[level];
}

/**
 * Quantity for display: up to 3 decimals, trailing zeros trimmed, locale
 * separator (comma for fr/ar, dot for en). 4 → "4", 0.25 → "0,25".
 */
export function formatQty(qty: number | null | undefined, lang: Language = "fr"): string {
  if (qty == null || !Number.isFinite(qty)) return "0";
  const rounded = Math.round(qty * 1000) / 1000;
  let s = rounded.toFixed(3);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  if (s === "" || s === "-0") s = "0";
  return lang === "en" ? s : s.replace(".", ",");
}

/**
 * How much to buy to reach the par level, or null when no par is set.
 * Never negative (already at/above par → 0).
 */
export function suggestReorderQty(item: {
  qty_on_hand: number;
  par_level: number | null | undefined;
}): number | null {
  if (item.par_level == null) return null;
  return Math.max(0, Math.round((item.par_level - item.qty_on_hand) * 1000) / 1000);
}

/** Value of the on-hand stock in millimes (never counts negative on-hand). */
export function stockValueMillimes(item: {
  qty_on_hand: number;
  unit_cost_millimes: number | null | undefined;
}): number {
  if (!item.unit_cost_millimes) return 0;
  return Math.round(Math.max(0, item.qty_on_hand) * item.unit_cost_millimes);
}

// ------------------------------------------------------------
// Row shapes (as returned by the inventory RPCs).
// ------------------------------------------------------------

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  qty_on_hand: number;
  reorder_threshold: number;
  par_level: number | null;
  unit_cost_millimes: number | null;
  track: boolean;
  auto_86: boolean;
  supplier_name: string;
  supplier_phone: string;
  note: string;
  level: StockLevel;
  linked_items: number;
  updated_at: string;
}

export interface InventorySummary {
  total: number;
  ok: number;
  low: number;
  out: number;
  value_millimes: number;
}

export interface InventoryOverview {
  summary: InventorySummary;
  items: InventoryItem[];
}

export interface StockMovement {
  id: string;
  type: MovementType;
  qty_delta: number;
  qty_after: number;
  unit_cost_millimes: number | null;
  reason: string;
  order_id: string | null;
  created_at: string;
}

/** Payload stored on a stock notification (`data`), rendered client-side. */
export interface StockAlertData {
  name: string;
  qty: number;
  unit: string;
  level: StockLevel;
  threshold: number;
}

export interface AppNotification {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  inventory_item_id: string | null;
  data: StockAlertData & Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}
