import type { Language } from "./types";

/**
 * Money: stored as integer millimes (1 TND = 1000 millimes).
 * Display follows the design system: "5,5 TND" (fr), "5,5 د.ت" (ar), "5.5 TND" (en).
 * Western numerals everywhere, including Arabic.
 */

export function millimesToDisplay(millimes: number, lang: Language = "fr"): string {
  const negative = millimes < 0;
  const abs = Math.abs(millimes);
  const dinars = Math.floor(abs / 1000);
  const rem = abs % 1000;

  // Trim trailing zeros but keep at least one decimal, matching the design
  // ("2,8", "6,0", "27,6"; "5,550" stays "5,55").
  let frac = String(rem).padStart(3, "0");
  while (frac.length > 1 && frac.endsWith("0")) frac = frac.slice(0, -1);

  const sep = lang === "en" ? "." : ",";
  return `${negative ? "−" : ""}${dinars}${sep}${frac}`;
}

export function currencyLabel(lang: Language): string {
  return lang === "ar" ? "د.ت" : "TND";
}

export function formatPrice(millimes: number, lang: Language = "fr"): string {
  return `${millimesToDisplay(millimes, lang)} ${currencyLabel(lang)}`;
}

/** "+1,0" style modifier deltas; empty string for zero. */
export function formatDelta(millimes: number, lang: Language = "fr"): string {
  if (millimes === 0) return "";
  const sign = millimes > 0 ? "+" : "−";
  return `${sign}${millimesToDisplay(Math.abs(millimes), lang)}`;
}

/** Whole large numbers with thin-space thousands grouping: 1284 → "1 284". */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ");
}

/** Relative elapsed time for order cards, e.g. "il y a 8 s" / "4 min 12 s". */
export function formatElapsed(sinceIso: string, now: Date = new Date()): { minutes: number; seconds: number } {
  const ms = Math.max(0, now.getTime() - new Date(sinceIso).getTime());
  const totalSeconds = Math.floor(ms / 1000);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

/** mm:ss ticker for kitchen timers. */
export function formatTimer(sinceIso: string, now: Date = new Date()): string {
  const { minutes, seconds } = formatElapsed(sinceIso, now);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatClock(date: Date, lang: Language = "fr"): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  if (lang === "en") {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${ampm}`;
  }
  return `${h}:${m}`;
}

/**
 * Accent/variant-insensitive folding for customer search: strips Latin
 * diacritics (café → cafe) and normalises the Arabic letters customers type
 * interchangeably (hamza'd alefs → ا, ة → ه, ى → ي). Fold BOTH the query and
 * the haystack before comparing.
 */
export function foldSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}
