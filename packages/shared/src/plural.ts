import type { Dictionary } from "./i18n/fr";

/**
 * "1 article" / "3 articles" — the item-count label, with the singular actually
 * applied.
 *
 * The dictionary has carried both `common.item` and `common.items` from the
 * start, but only two of the nine call sites ever used the singular; the other
 * seven hardcoded `t.common.items`, so an English customer with one item in
 * their usual, cart bar or order summary read **"1 items"**.
 *
 * `count > 1` rather than `count !== 1` is deliberate — it matches the two
 * sites that already got this right, and it is correct for French, where 0 and
 * 1 both take the singular ("0 article", "1 article"). English "0 items" would
 * want the plural, but no caller here ever renders a zero count: every one of
 * them is behind a non-empty cart, order or usual.
 */
export function itemCount(count: number, t: Dictionary): string {
  return `${count} ${count > 1 ? t.common.items : t.common.item}`;
}
