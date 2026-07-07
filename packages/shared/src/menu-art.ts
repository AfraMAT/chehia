import type { I18nText } from "./types";

/**
 * Default menu artwork — when a business hasn't uploaded a photo for an item or
 * category, we show a tasteful, theme-aware illustration instead of an empty
 * placeholder. The art is auto-matched from the name (multilingual keywords),
 * or the business can pick a specific one. The SVGs live in each app
 * (web/mobile); this module owns the ids + matching so both stay in sync.
 */

export const MENU_ART_IDS = [
  "coffee",
  "tea",
  "juice",
  "drink",
  "pastry",
  "dessert",
  "breakfast",
  "bread",
  "salad",
  "main",
  "pizza",
  "generic",
] as const;
export type MenuArtId = (typeof MENU_ART_IDS)[number];

/** How the customer menu fills item/category images that have no photo. */
export const IMAGE_STYLES = ["illustration", "pattern", "plain"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

/** Keyword → art id. Checked in order, so put specific before general. */
const MATCHERS: { id: MenuArtId; keywords: string[] }[] = [
  { id: "coffee", keywords: ["café", "cafe", "espresso", "expresso", "cappuccino", "capucino", "latte", "moka", "mocha", "قهوة", "كابوت", "coffee", "americano", "macchiato"] },
  { id: "tea", keywords: ["thé", "the ", "théière", "menthe", "شاي", "نعناع", "tea", "mint", "infusion", "tisane"] },
  { id: "juice", keywords: ["jus", "citronnade", "citron", "orange", "smoothie", "milkshake", "عصير", "ليمون", "juice", "lemonade", "shake"] },
  { id: "drink", keywords: ["eau", "soda", "boisson", "coca", "limonade", "ماء", "مشروب", "water", "soft", "cola", "boga", "canette"] },
  { id: "pizza", keywords: ["pizza", "بيتزا", "margherita"] },
  { id: "pastry", keywords: ["croissant", "viennois", "pain au chocolat", "brioche", "chausson", "pâtisser", "patisser", "معجنات", "pastry", "danish", "muffin", "cupcake", "beignet"] },
  { id: "dessert", keywords: ["dessert", "gâteau", "gateau", "glace", "crème", "creme", "tarte", "tiramisu", "حلوى", "حلويات", "آيس", "cake", "ice cream", "sweet", "flan", "mille"] },
  { id: "breakfast", keywords: ["petit-déj", "petit déj", "petit dej", "déjeuner", "œuf", "oeuf", "omelette", "فطور", "بيض", "breakfast", "egg", "brunch", "msemen", "chakchouka", "shakshuka"] },
  { id: "bread", keywords: ["pain", "sandwich", "chapati", "panini", "baguette", "wrap", "خبز", "ساندويتش", "bread", "burger", "tacos", "fricassé", "fricasse", "casse-croûte", "kaskrout"] },
  { id: "salad", keywords: ["salade", "bowl", "سلطة", "salad", "mechouia", "méchouia"] },
  { id: "main", keywords: ["plat", "tajine", "tagine", "couscous", "ojja", "kafteji", "lablabi", "grill", "grillade", "viande", "poulet", "poisson", "طبق", "لحم", "دجاج", "سمك", "كسكسي", "main", "dish", "lunch", "dinner", "meat", "chicken", "fish", "steak", "escalope", "merguez", "spaghetti", "pâtes", "pates", "pasta", "riz"] },
];

/** Concatenate every localized string on a name for keyword scanning. */
function haystack(name: I18nText | null | undefined): string {
  if (!name) return "";
  return Object.values(name).filter(Boolean).join(" ").toLowerCase();
}

/** Pick the best-fitting illustration for an item/category name; never null. */
export function pickMenuArt(name: I18nText | null | undefined): MenuArtId {
  const text = haystack(name);
  if (text) {
    for (const { id, keywords } of MATCHERS) {
      if (keywords.some((k) => text.includes(k))) return id;
    }
  }
  return "generic";
}

/** Validate a stored art id, or null. */
export function coerceArtId(value: unknown): MenuArtId | null {
  return typeof value === "string" && (MENU_ART_IDS as readonly string[]).includes(value) ? (value as MenuArtId) : null;
}

/**
 * The art to render for an item/category: an explicit choice wins; otherwise
 * match the name, and if that's inconclusive fall back to the (optional) parent
 * category name — so e.g. an item named "Direct" under "Cafés" still gets coffee art.
 */
export function resolveMenuArt(
  art: string | null | undefined,
  name: I18nText | null | undefined,
  fallbackName?: I18nText | null,
): MenuArtId {
  const explicit = coerceArtId(art);
  if (explicit) return explicit;
  const byName = pickMenuArt(name);
  if (byName !== "generic") return byName;
  return fallbackName ? pickMenuArt(fallbackName) : "generic";
}
