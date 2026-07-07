import type { I18nText } from "./types";

/**
 * Per-venue menu appearance — color themes + layout choices that re-skin and
 * re-shape the customer menu. Single source of truth for the web app (which
 * injects the palette as CSS custom properties) and the mobile app (which reads
 * it into a runtime theme context). All values are stored on
 * `restaurants.appearance` (jsonb) and MUST be read through `resolveAppearance`
 * so a missing/partial/garbage blob always degrades to a valid default.
 */

// ------------------------------------------------------------------
// Palette — the themeable token subset of the design system.
// Semantic order-state colors (success/warning/danger) are intentionally NOT
// themeable: they must stay legible and consistent across every venue.
// ------------------------------------------------------------------
export interface ThemePalette {
  primary: string; // brand / CTAs (maps to --color-harissa)
  primaryPressed: string;
  primaryTint: string; // pale chip background
  primarySoft: string; // brand accent on darker surfaces
  primaryPeach: string;
  accent: string; // secondary / info (maps to --color-teal)
  accentPressed: string;
  accentTint: string;
  ink: string; // primary text
  muted: string; // secondary text
  mutedSoft: string; // tertiary text / captions (kept ≥ AA on bg)
  disabled: string;
  bg: string; // app background (maps to --color-cream)
  card: string; // card surface
  sand: string; // wells
  sandDeep: string;
  line: string; // hairline borders
  lineStrong: string;
  lineDashed: string;
  photo: string; // photo placeholder weave
  photoAlt: string;
}

/** ThemePalette key → the CSS custom property it drives in globals.css. */
export const THEME_VAR_MAP: Record<keyof ThemePalette, string> = {
  primary: "--color-harissa",
  primaryPressed: "--color-harissa-pressed",
  primaryTint: "--color-harissa-tint",
  primarySoft: "--color-harissa-soft",
  primaryPeach: "--color-harissa-peach",
  accent: "--color-teal",
  accentPressed: "--color-teal-pressed",
  accentTint: "--color-teal-tint",
  ink: "--color-ink",
  muted: "--color-muted",
  mutedSoft: "--color-muted-soft",
  disabled: "--color-disabled",
  bg: "--color-cream",
  card: "--color-card",
  sand: "--color-sand",
  sandDeep: "--color-sand-deep",
  line: "--color-line",
  lineStrong: "--color-line-strong",
  lineDashed: "--color-line-dashed",
  photo: "--color-photo",
  photoAlt: "--color-photo-alt",
};

const PALETTE_KEYS = Object.keys(THEME_VAR_MAP) as (keyof ThemePalette)[];

export interface ThemePreset {
  id: string;
  name_i18n: I18nText;
  palette: ThemePalette;
  /** True when the background is dark (informs the portal preview + contrast). */
  dark?: boolean;
}

export const CATEGORY_LAYOUTS = ["grid", "list", "circles", "banner", "carousel", "classic"] as const;
export type CategoryLayout = (typeof CATEGORY_LAYOUTS)[number];

export const ITEM_LAYOUTS = ["list", "cards", "compact"] as const;
export type ItemLayout = (typeof ITEM_LAYOUTS)[number];

export interface MenuAppearance {
  /** id of a BUILTIN_THEMES / extractedPalettes entry, or "custom". */
  themeId: string;
  /** Full or partial palette used when themeId === "custom". */
  customPalette?: Partial<ThemePalette>;
  /** Palettes derived from the venue's scanned menu photo (selectable as themes). */
  extractedPalettes?: ThemePreset[];
  categoryLayout: CategoryLayout;
  itemLayout: ItemLayout;
  /** When false, the menu opens straight to items (the pre-feature behaviour). */
  showCategoryLanding: boolean;
}

// ------------------------------------------------------------------
// Pure color utilities (no dependencies; fully testable).
// ------------------------------------------------------------------
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse "#rrggbb" / "#rgb" (leniently); returns black for anything invalid. */
export function hexToRgb(hex: string): Rgb {
  let h = (hex ?? "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, "0")).join("")}`;
}

/** True if a string looks like a hex color we can parse. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Linear blend of two hex colors. t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

export const darken = (hex: string, amount: number): string => mix(hex, "#000000", amount);
export const lighten = (hex: string, amount: number): string => mix(hex, "#ffffff", amount);

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const isDarkColor = (hex: string): boolean => relativeLuminance(hex) < 0.4;

/**
 * Nudge `fg` toward black or white (whichever raises contrast against `bg`)
 * until it meets `min`. Guarantees a legible text color on any background.
 */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const target = relativeLuminance(bg) > 0.45 ? "#000000" : "#ffffff";
  for (let t = 0.1; t <= 1; t += 0.1) {
    const candidate = mix(fg, target, t);
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return target;
}

// ------------------------------------------------------------------
// Default palette — the current "Harissa & Sidi Bou" tokens verbatim, so a
// venue that never customizes looks exactly as it does today.
// ------------------------------------------------------------------
export const DEFAULT_PALETTE: ThemePalette = {
  primary: "#bc4b26",
  primaryPressed: "#a03d1d",
  primaryTint: "#f7e7de",
  primarySoft: "#e08d6b",
  primaryPeach: "#f2c7a8",
  accent: "#10606a",
  accentPressed: "#0b4a52",
  accentTint: "#e1eeee",
  ink: "#221a13",
  muted: "#6e6257",
  mutedSoft: "#786a5c",
  disabled: "#c9bfb2",
  bg: "#faf6ef",
  card: "#fffdf9",
  sand: "#f6f1e8",
  sandDeep: "#f1eae0",
  line: "#ede4d8",
  lineStrong: "#e3d9cb",
  lineDashed: "#d8ccba",
  photo: "#f2e5d4",
  photoAlt: "#ebdcc7",
};

/** The few colors an extraction / preset needs to specify; the rest are derived. */
export interface SeedColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
}

/**
 * Expand a handful of seed colors into a full, contrast-safe palette. Used both
 * for the built-in presets and for palettes derived from a scanned menu photo.
 */
export function expandPalette(seed: SeedColors): ThemePalette {
  const { primary, background: bg, surface, text, accent } = seed;
  return {
    primary,
    primaryPressed: darken(primary, 0.14),
    primaryTint: mix(primary, surface, 0.86),
    primarySoft: mix(primary, bg, 0.4),
    primaryPeach: mix(primary, surface, 0.55),
    accent,
    accentPressed: darken(accent, 0.14),
    accentTint: mix(accent, surface, 0.86),
    ink: ensureContrast(text, bg, 6),
    muted: ensureContrast(mix(text, bg, 0.28), bg, 4.5),
    mutedSoft: ensureContrast(mix(text, bg, 0.4), bg, 4.5),
    disabled: mix(text, bg, 0.62),
    bg,
    card: surface,
    sand: mix(surface, text, 0.05),
    sandDeep: mix(surface, text, 0.09),
    line: mix(surface, text, 0.12),
    lineStrong: mix(surface, text, 0.18),
    lineDashed: mix(surface, text, 0.24),
    photo: mix(primary, surface, 0.72),
    photoAlt: mix(primary, surface, 0.64),
  };
}

// ------------------------------------------------------------------
// Built-in themes. `harissa` (the default) uses the exact current tokens;
// the rest are expanded from seeds so they stay internally consistent + legible.
// ------------------------------------------------------------------
interface SeedPreset {
  id: string;
  name_i18n: I18nText;
  seed: SeedColors;
  dark?: boolean;
}

const SEED_PRESETS: SeedPreset[] = [
  {
    id: "nocturne",
    name_i18n: { fr: "Nocturne", ar: "ليلي", en: "Nocturne" },
    dark: true,
    seed: { primary: "#e0894a", background: "#1a1712", surface: "#241f19", text: "#f4ede4", accent: "#6fb3ae" },
  },
  {
    id: "olive",
    name_i18n: { fr: "Olive", ar: "زيتون", en: "Olive" },
    seed: { primary: "#6b7a3a", background: "#f7f6ef", surface: "#fffef8", text: "#23271a", accent: "#a6772f" },
  },
  {
    id: "azur",
    name_i18n: { fr: "Azur", ar: "أزرق", en: "Azure" },
    seed: { primary: "#2e6db4", background: "#f5f8fc", surface: "#ffffff", text: "#16233a", accent: "#c6603f" },
  },
  {
    id: "rosewater",
    name_i18n: { fr: "Eau de rose", ar: "ماء الورد", en: "Rosewater" },
    seed: { primary: "#c24e6b", background: "#fbf4f4", surface: "#ffffff", text: "#33212a", accent: "#4e8c86" },
  },
  {
    id: "saffron",
    name_i18n: { fr: "Safran", ar: "زعفران", en: "Saffron" },
    seed: { primary: "#d69a1e", background: "#fef9ee", surface: "#fffdf6", text: "#2c2410", accent: "#326e63" },
  },
  {
    id: "charcoal",
    name_i18n: { fr: "Charbon", ar: "فحمي", en: "Charcoal" },
    seed: { primary: "#e5732e", background: "#eceae6", surface: "#f8f7f4", text: "#1e1b18", accent: "#3c7a80" },
  },
  {
    id: "sable",
    name_i18n: { fr: "Sable", ar: "رملي", en: "Sable" },
    seed: { primary: "#b06a3b", background: "#f6efe3", surface: "#fffdf8", text: "#2a2016", accent: "#4b7a6e" },
  },
];

export const BUILTIN_THEMES: ThemePreset[] = [
  { id: "harissa", name_i18n: { fr: "Harissa", ar: "هريسة", en: "Harissa" }, palette: DEFAULT_PALETTE },
  ...SEED_PRESETS.map((p) => ({ id: p.id, name_i18n: p.name_i18n, palette: expandPalette(p.seed), dark: p.dark })),
];

export const DEFAULT_THEME_ID = "harissa";

export const DEFAULT_APPEARANCE: MenuAppearance = {
  themeId: DEFAULT_THEME_ID,
  categoryLayout: "grid",
  itemLayout: "list",
  showCategoryLanding: true,
};

// ------------------------------------------------------------------
// Resolution — the single guarded entry point for reading appearance.
// ------------------------------------------------------------------
function coerceEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** True when `p` has at least the palette shape (all keys present + string). */
function isPalette(p: unknown): p is ThemePalette {
  if (!p || typeof p !== "object") return false;
  const obj = p as Record<string, unknown>;
  return PALETTE_KEYS.every((k) => typeof obj[k] === "string");
}

function sanitizePartialPalette(p: unknown): Partial<ThemePalette> | undefined {
  if (!p || typeof p !== "object") return undefined;
  const obj = p as Record<string, unknown>;
  const out: Partial<ThemePalette> = {};
  for (const k of PALETTE_KEYS) {
    if (isHexColor(obj[k])) out[k] = normalizeHex(obj[k] as string);
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeHex(hex: string): string {
  return rgbToHex(hexToRgb(hex));
}

function sanitizePresets(value: unknown): ThemePreset[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: ThemePreset[] = [];
  for (const entry of value.slice(0, 8)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id === "string" && isPalette(e.palette)) {
      out.push({
        id: e.id,
        name_i18n: (e.name_i18n && typeof e.name_i18n === "object" ? e.name_i18n : {}) as I18nText,
        palette: e.palette as ThemePalette,
        dark: e.dark === true,
      });
    }
  }
  return out.length ? out : undefined;
}

/** Parse a raw `restaurants.appearance` blob into a complete, valid config. Never throws. */
export function resolveAppearance(raw: unknown): MenuAppearance {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    themeId: typeof obj.themeId === "string" && obj.themeId ? obj.themeId : DEFAULT_APPEARANCE.themeId,
    customPalette: sanitizePartialPalette(obj.customPalette),
    extractedPalettes: sanitizePresets(obj.extractedPalettes),
    categoryLayout: coerceEnum(obj.categoryLayout, CATEGORY_LAYOUTS, DEFAULT_APPEARANCE.categoryLayout),
    itemLayout: coerceEnum(obj.itemLayout, ITEM_LAYOUTS, DEFAULT_APPEARANCE.itemLayout),
    showCategoryLanding:
      typeof obj.showCategoryLanding === "boolean" ? obj.showCategoryLanding : DEFAULT_APPEARANCE.showCategoryLanding,
  };
}

/** Every theme the venue can select from (built-ins + its extracted palettes). */
export function availableThemes(appearance: MenuAppearance): ThemePreset[] {
  return [...BUILTIN_THEMES, ...(appearance.extractedPalettes ?? [])];
}

/** The concrete palette to render, following themeId → custom → default. */
export function resolveThemePalette(appearance: MenuAppearance): ThemePalette {
  if (appearance.themeId === "custom") {
    return { ...DEFAULT_PALETTE, ...(appearance.customPalette ?? {}) };
  }
  const preset = availableThemes(appearance).find((p) => p.id === appearance.themeId);
  return preset?.palette ?? DEFAULT_PALETTE;
}

/** True when the active palette is dark (drives status-bar / preview treatment). */
export function isDarkPalette(palette: ThemePalette): boolean {
  return isDarkColor(palette.bg);
}

/** Map a palette to the `--color-*` overrides for a web wrapper's inline style. */
export function paletteToCssVars(palette: ThemePalette): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of PALETTE_KEYS) {
    vars[THEME_VAR_MAP[key]] = palette[key];
  }
  return vars;
}

/** Convenience: raw appearance blob → CSS var overrides in one call. */
export function appearanceCssVars(raw: unknown): Record<string, string> {
  return paletteToCssVars(resolveThemePalette(resolveAppearance(raw)));
}

/**
 * Build a selectable ThemePreset from an extract-menu `palette` object
 * ({ theme_name?, primary, background, surface, text, accent }). Returns null
 * unless all five seed colors are valid hex — so a menu with no discernible
 * palette simply yields no theme.
 */
export function extractedPresetFromRaw(raw: unknown, id: string): ThemePreset | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const seedKeys: (keyof SeedColors)[] = ["primary", "background", "surface", "text", "accent"];
  const seed = {} as SeedColors;
  for (const key of seedKeys) {
    const v = o[key];
    if (!isHexColor(v)) return null;
    seed[key] = normalizeHex(v as string);
  }
  const nameStr = typeof o.theme_name === "string" && o.theme_name.trim() ? o.theme_name.trim().slice(0, 40) : "";
  return {
    id,
    name_i18n: nameStr ? { fr: nameStr, en: nameStr, ar: nameStr } : {},
    palette: expandPalette(seed),
    dark: isDarkColor(seed.background),
  };
}

/** Append an extracted preset to a venue's appearance (dedup by id, cap at 6). */
export function withExtractedPalette(raw: unknown, preset: ThemePreset): MenuAppearance {
  const appearance = resolveAppearance(raw);
  const existing = (appearance.extractedPalettes ?? []).filter((p) => p.id !== preset.id);
  return { ...appearance, extractedPalettes: [preset, ...existing].slice(0, 6) };
}
