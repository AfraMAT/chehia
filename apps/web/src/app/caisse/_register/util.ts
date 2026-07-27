import { formatPrice, type I18nText, type Language } from "@chehia/shared";

/**
 * Item and category names come from the multilingual menu, so callers pass the
 * register's active language (`useI18n().lang`) and we fall back gracefully when
 * that language is missing from a given name.
 */
export function txt(value: I18nText | null | undefined, lang: Language = "fr"): string {
  if (!value) return "";
  const record = value as Record<string, string>;
  return record[lang] || record.fr || Object.values(record)[0] || "";
}

/**
 * Every localised spelling of a name, lower-cased — the search index for the
 * product grid. Matching only the displayed language means an Arabic cashier
 * cannot find an item whose Arabic name they are reading off the tile.
 */
export function searchText(value: I18nText | null | undefined): string {
  if (!value) return "";
  return Object.values(value as Record<string, string>).join(" ").toLowerCase();
}

/** "3.500 TND" (fr/en) or "3,500 د.ت" (ar) for a millimes amount. */
export function money(millimes: number, lang: Language = "fr"): string {
  return formatPrice(millimes, lang);
}
