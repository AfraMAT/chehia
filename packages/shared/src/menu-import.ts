/**
 * Photo → AI menu import: shared types + pure helpers.
 *
 * The AI (extract-menu edge function) returns a MenuDraft; the portal review UI
 * lets the owner edit it, then import_menu_draft persists it. Money stays in
 * integer millimes (1 TND = 1000). These helpers are the trust boundary the UI
 * and the tests share — no I/O, no framework.
 */
import type { I18nText, Language } from "./types";

export interface DraftItem {
  name_i18n: I18nText;
  description_i18n?: I18nText;
  /** Integer millimes (TND × 1000); 0 means "no printed price" — flagged for review. */
  price_millimes: number;
  dietary_tags?: string[];
}

export interface DraftCategory {
  name_i18n: I18nText;
  items: DraftItem[];
}

export interface MenuDraft {
  source_language: "fr" | "ar" | "en" | "mixed";
  categories: DraftCategory[];
}

// Currency words/symbols a Tunisian menu might print next to the number.
const CURRENCY_RE = /(dt|tnd|dinars?|millimes?|mill\.?|دينار|د\.?ت)/g;

/**
 * Parse a Tunisian price string → integer millimes, or null if unparseable.
 * Superset of item-editor.parsePrice (comma→dot, ×1000), plus millimes-vs-dinars
 * disambiguation for bare integers:
 *   "3,500" / "3.500" / "3,5" / "3.5" → 3500   (decimal separator → dinars)
 *   "3" → 3000   "12,000" → 12000   "0,500" → 500   "1 500" → 1500   "3500" → 3500
 *   "" / "SAISON" / "—" / "-2" / "abc" / "3,5,5" → null
 */
export function parseMenuPrice(raw: string): number | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(CURRENCY_RE, "").replace(/\s+/g, "").replace(/,/g, ".");
  if (!s) return null;
  if ((s.match(/\./g)?.length ?? 0) > 1) return null; // e.g. "3.5.5"
  if (!/^\d+(\.\d+)?$/.test(s)) return null; // rejects "-2", "abc", "—"
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  // A decimal point means the value is in dinars (3.5 DT → 3500). A bare integer
  // under ~100 is dinars (3 → 3000); a larger bare integer is already millimes.
  const millimes = s.includes(".") ? Math.round(n * 1000) : n < 100 ? n * 1000 : n;
  return Math.round(millimes);
}

export type DraftIssue = "no_items" | "missing_price" | "name_too_long";

/**
 * Defensively normalize an untrusted extract-menu response into a MenuDraft,
 * keeping only the venue's languages, dropping malformed rows, and collecting
 * review issues. The edge function already schema-constrains the model, but the
 * client never trusts network data.
 */
export function validateDraft(
  raw: unknown,
  venueLanguages: Language[],
): { ok: boolean; draft: MenuDraft; issues: DraftIssue[] } {
  const issues = new Set<DraftIssue>();
  const langs = venueLanguages.length ? venueLanguages : (["fr"] as Language[]);
  const obj = (raw ?? {}) as Record<string, unknown>;

  const cleanI18n = (v: unknown): I18nText => {
    const out: I18nText = {};
    if (v && typeof v === "object") {
      for (const l of langs) {
        const val = (v as Record<string, unknown>)[l];
        if (typeof val === "string" && val.trim()) out[l] = val.trim().slice(0, 300);
      }
    }
    return out;
  };

  const rawCats = Array.isArray(obj.categories) ? obj.categories : [];
  const categories: DraftCategory[] = [];
  let itemCount = 0;

  for (const rc of rawCats.slice(0, 40)) {
    const cat = (rc ?? {}) as Record<string, unknown>;
    const name_i18n = cleanI18n(cat.name_i18n);
    const rawItems = Array.isArray(cat.items) ? cat.items : [];
    const items: DraftItem[] = [];
    for (const ri of rawItems.slice(0, 200)) {
      const it = (ri ?? {}) as Record<string, unknown>;
      const iname = cleanI18n(it.name_i18n);
      if (!langs.some((l) => iname[l])) continue; // an item needs at least one name
      if (langs.some((l) => (iname[l]?.length ?? 0) > 120)) issues.add("name_too_long");
      const rawPrice = it.price_millimes;
      const price =
        typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice >= 0 ? Math.round(rawPrice) : 0;
      if (price === 0) issues.add("missing_price");
      const item: DraftItem = { name_i18n: iname, price_millimes: price };
      const desc = cleanI18n(it.description_i18n);
      if (Object.keys(desc).length) item.description_i18n = desc;
      if (Array.isArray(it.dietary_tags)) {
        const tags = it.dietary_tags.filter((tag): tag is string => typeof tag === "string");
        if (tags.length) item.dietary_tags = tags;
      }
      items.push(item);
      itemCount++;
    }
    if (items.length || Object.keys(name_i18n).length) categories.push({ name_i18n, items });
  }

  if (itemCount === 0) issues.add("no_items");
  const src = obj.source_language;
  const source_language =
    src === "fr" || src === "ar" || src === "en" || src === "mixed" ? src : "fr";

  return { ok: itemCount > 0, draft: { source_language, categories }, issues: [...issues] };
}
