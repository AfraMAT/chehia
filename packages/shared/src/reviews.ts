import type { I18nText, Language } from "./types";

/** Ratings & reviews domain — shared by the customer apps and the portals. */

export type ReviewStatus = "pending" | "approved" | "rejected" | "hidden";
export type Sentiment = "love" | "good" | "meh";

/** The three faces the customer taps for the overall visit. Order = display order. */
export const SENTIMENTS: Sentiment[] = ["love", "good", "meh"];

export const SENTIMENT_EMOJI: Record<Sentiment, string> = {
  love: "😍",
  good: "🙂",
  meh: "😐",
};

/**
 * A tapped face maps to a star value so a venue still shows an average
 * star rating: 😍 = 5, 🙂 = 4, 😐 = 2.
 */
export const SENTIMENT_RATING: Record<Sentiment, number> = {
  love: 5,
  good: 4,
  meh: 2,
};

export function sentimentToRating(s: Sentiment): number {
  return SENTIMENT_RATING[s];
}

/** A public review as returned to the customer app (already approved). */
export interface PublicReview {
  rating: number;
  comment: string;
  /** null → render as the localized "Client". */
  name: string | null;
  created_at: string;
}

/** Item aggregate + recent reviews (from the item_reviews RPC). */
export interface ItemReviews {
  rating_avg: number | null;
  rating_count: number;
  reviews: PublicReview[];
}

/** Venue aggregate + star distribution (from the venue_rating_summary RPC). */
export interface VenueRatingSummary {
  rating_avg: number | null;
  rating_count: number;
  distribution: Record<string, number>;
}

/**
 * Fill state (0..1) for each of the 5 stars given an average like 4.3.
 * [1, 1, 1, 1, 0.3] — lets a display render partial stars.
 */
export function starFills(avg: number | null | undefined): number[] {
  const v = Math.max(0, Math.min(5, avg ?? 0));
  return [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(1, v - i)));
}

/** One decimal, locale separator: 4.3 → "4,3" (fr/ar) / "4.3" (en). */
export function formatRating(avg: number | null | undefined, lang: Language = "fr"): string {
  if (avg == null) return "—";
  const s = (Math.round(avg * 10) / 10).toFixed(1);
  return lang === "en" ? s : s.replace(".", ",");
}

/** Warm, short relative time for review lists: "il y a 2 j" / "hier" / "à l'instant". */
export function formatRelativeTime(iso: string, lang: Language = "fr", now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((now.getTime() - then) / 60000));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const T = REL_TIME[lang] ?? REL_TIME.fr;
  if (mins < 2) return T.now;
  if (mins < 60) return T.min(mins);
  if (hours < 24) return T.hour(hours);
  if (days === 1) return T.yesterday;
  if (days < 30) return T.day(days);
  const months = Math.floor(days / 30);
  return T.month(months);
}

const REL_TIME: Record<Language, {
  now: string;
  yesterday: string;
  min: (n: number) => string;
  hour: (n: number) => string;
  day: (n: number) => string;
  month: (n: number) => string;
}> = {
  fr: {
    now: "à l'instant",
    yesterday: "hier",
    min: (n) => `il y a ${n} min`,
    hour: (n) => `il y a ${n} h`,
    day: (n) => `il y a ${n} j`,
    month: (n) => `il y a ${n} mois`,
  },
  ar: {
    now: "الآن",
    yesterday: "أمس",
    min: (n) => `منذ ${n} د`,
    hour: (n) => `منذ ${n} س`,
    day: (n) => `منذ ${n} ي`,
    month: (n) => `منذ ${n} شهر`,
  },
  en: {
    now: "just now",
    yesterday: "yesterday",
    min: (n) => `${n} min ago`,
    hour: (n) => `${n} h ago`,
    day: (n) => `${n} d ago`,
    month: (n) => `${n} mo ago`,
  },
};

/** Item name resolved for a card, given its i18n text. Re-exported convenience. */
export type { I18nText };
