import type { I18nText, MenuItem, Modifier, ModifierGroup } from "./types";

/**
 * Cart domain logic — pure functions, no storage. Both apps persist the
 * cart themselves (AsyncStorage / localStorage) and re-validate on submit;
 * the server recomputes all prices in the place-order edge function.
 */

export interface CartLine {
  /** Stable identity: item + sorted modifier ids + note. */
  key: string;
  itemId: string;
  name: I18nText;
  qty: number;
  /** base price + modifier deltas, per unit */
  unitPriceMillimes: number;
  modifierIds: string[];
  modifierLabels: { group: I18nText; choice: I18nText; delta: number }[];
  note: string;
}

export interface Cart {
  restaurantId: string;
  qrToken: string;
  lines: CartLine[];
  note: string;
}

export function emptyCart(restaurantId: string, qrToken: string): Cart {
  return { restaurantId, qrToken, lines: [], note: "" };
}

export function lineKey(itemId: string, modifierIds: string[], note: string): string {
  return [itemId, [...modifierIds].sort().join("+"), note.trim()].join("|");
}

export function buildLine(
  item: MenuItem,
  groups: ModifierGroup[],
  modifierIds: string[],
  qty: number,
  note = "",
): CartLine {
  const chosen: { group: I18nText; choice: I18nText; delta: number }[] = [];
  let delta = 0;
  for (const group of groups) {
    for (const mod of group.modifiers) {
      if (modifierIds.includes(mod.id)) {
        chosen.push({ group: group.name_i18n, choice: mod.name_i18n, delta: mod.price_delta_millimes });
        delta += mod.price_delta_millimes;
      }
    }
  }
  return {
    key: lineKey(item.id, modifierIds, note),
    itemId: item.id,
    name: item.name_i18n,
    qty,
    unitPriceMillimes: item.price_millimes + delta,
    modifierIds,
    modifierLabels: chosen,
    note: note.trim(),
  };
}

/** Server-enforced per-line quantity cap. */
export const MAX_LINE_QTY = 20;

/** Add a line; merges with an identical line (same item+modifiers+note), capped at MAX_LINE_QTY. */
export function addLine(cart: Cart, line: CartLine): Cart {
  const existing = cart.lines.find((l) => l.key === line.key);
  if (existing) {
    return {
      ...cart,
      lines: cart.lines.map((l) =>
        l.key === line.key ? { ...l, qty: Math.min(l.qty + line.qty, MAX_LINE_QTY) } : l,
      ),
    };
  }
  return { ...cart, lines: [...cart.lines, { ...line, qty: Math.min(line.qty, MAX_LINE_QTY) }] };
}

export function setQty(cart: Cart, key: string, qty: number): Cart {
  if (qty <= 0) {
    return { ...cart, lines: cart.lines.filter((l) => l.key !== key) };
  }
  return {
    ...cart,
    lines: cart.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, MAX_LINE_QTY) } : l)),
  };
}

/**
 * Reconcile a persisted cart against a freshly loaded menu:
 * - drop lines whose item vanished or is no longer available;
 * - drop lines whose selected modifiers no longer exist;
 * - reprice every kept line from current data (persisted prices go stale).
 */
export function reconcileCart(
  cart: Cart,
  items: MenuItem[],
  groupsByItem: Record<string, ModifierGroup[]>,
): { cart: Cart; dropped: number } {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const kept: CartLine[] = [];
  let dropped = 0;

  for (const line of cart.lines) {
    const item = itemById.get(line.itemId);
    if (!item || !item.is_available) {
      dropped += 1;
      continue;
    }
    const groups = groupsByItem[item.id] ?? [];
    const availableModifierIds = new Set(
      groups.flatMap((g) => g.modifiers.filter((m) => m.is_available).map((m) => m.id)),
    );
    if (!line.modifierIds.every((id) => availableModifierIds.has(id))) {
      dropped += 1;
      continue;
    }
    kept.push(buildLine(item, groups, line.modifierIds, line.qty, line.note));
  }

  return { cart: { ...cart, lines: kept }, dropped };
}

export function cartTotal(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.unitPriceMillimes * l.qty, 0);
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.qty, 0);
}

export interface ModifierValidation {
  ok: boolean;
  /** group ids failing min_select */
  missingGroups: string[];
  /** group ids failing max_select */
  overGroups: string[];
}

/** Validate a selection against the item's modifier groups (mirrors server rules). */
export function validateModifiers(groups: ModifierGroup[], modifierIds: string[]): ModifierValidation {
  const missing: string[] = [];
  const over: string[] = [];
  for (const group of groups) {
    const count = group.modifiers.filter(
      (m: Modifier) => modifierIds.includes(m.id) && m.is_available,
    ).length;
    if (count < group.min_select) missing.push(group.id);
    if (count > group.max_select) over.push(group.id);
  }
  return { ok: missing.length === 0 && over.length === 0, missingGroups: missing, overGroups: over };
}

/** Payload for the place-order edge function. */
export function toOrderPayload(cart: Cart, language: string) {
  return {
    qr_token: cart.qrToken,
    language,
    note: cart.note,
    lines: cart.lines.map((l) => ({
      item_id: l.itemId,
      qty: l.qty,
      modifier_ids: l.modifierIds,
      note: l.note,
    })),
  };
}
