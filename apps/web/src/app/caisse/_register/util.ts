import { currencyLabel, millimesToDisplay, type I18nText } from "@chehia/shared";

/**
 * The register is French-first (Tunisian café staff). Slice 1 hardcodes the FR
 * chrome; item/category names still come from the multilingual menu, so we pick
 * the French string with a graceful fallback. Arabic register chrome is a later pass.
 */
export function txt(value: I18nText | null | undefined, lang = "fr"): string {
  if (!value) return "";
  const record = value as Record<string, string>;
  return record[lang] || record.fr || Object.values(record)[0] || "";
}

/** "3.500 TND" for a millimes amount, French formatting. */
export function money(millimes: number): string {
  return `${millimesToDisplay(millimes, "fr")} ${currencyLabel("fr")}`;
}
