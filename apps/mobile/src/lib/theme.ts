import { createContext, useContext } from "react";
import {
  DEFAULT_PALETTE,
  colors,
  radius,
  resolveAppearance,
  resolveThemePalette,
  spacing,
  type Language,
  type ThemePalette,
} from "@chehia/shared";
import type { TextStyle, ViewStyle } from "react-native";

export { colors, radius, spacing };

/**
 * Runtime theme (Epic 1 · customizable menus). Each venue can re-skin the
 * customer menu via `restaurants.appearance`. We resolve that blob into a
 * palette with the shared helpers, then map it onto the SAME token names the
 * app already uses (`colors` keys) so components can swap `colors.X` for
 * `theme.X` with no other change. Only the themeable subset is here; semantic
 * order-state colors (success/warning/danger) and the kitchen palette stay
 * static — they must read consistently across every venue.
 */
export interface ThemeColors {
  harissa: string;
  harissaPressed: string;
  harissaTint: string;
  harissaSoft: string;
  harissaPeach: string;
  sidiBou: string;
  sidiBouPressed: string;
  sidiBouTint: string;
  ink: string;
  muted: string;
  mutedSoft: string;
  disabled: string;
  cream: string;
  card: string;
  sand: string;
  sandDeep: string;
  border: string;
  borderStrong: string;
  borderDashed: string;
  photoPlaceholder: string;
  photoPlaceholderAlt: string;
}

/** Map a resolved palette onto the app's token names. */
export function paletteToThemeColors(p: ThemePalette): ThemeColors {
  return {
    harissa: p.primary,
    harissaPressed: p.primaryPressed,
    harissaTint: p.primaryTint,
    harissaSoft: p.primarySoft,
    harissaPeach: p.primaryPeach,
    sidiBou: p.accent,
    sidiBouPressed: p.accentPressed,
    sidiBouTint: p.accentTint,
    ink: p.ink,
    muted: p.muted,
    mutedSoft: p.mutedSoft,
    disabled: p.disabled,
    cream: p.bg,
    card: p.card,
    sand: p.sand,
    sandDeep: p.sandDeep,
    border: p.line,
    borderStrong: p.lineStrong,
    borderDashed: p.lineDashed,
    photoPlaceholder: p.photo,
    photoPlaceholderAlt: p.photoAlt,
  };
}

/** Raw `restaurants.appearance` blob → the themed color set. Never throws. */
export function resolveThemeColors(rawAppearance: unknown): ThemeColors {
  return paletteToThemeColors(resolveThemePalette(resolveAppearance(rawAppearance)));
}

/** The default "Harissa & Sidi Bou" theme — value-identical to static `colors`. */
export const DEFAULT_THEME_COLORS: ThemeColors = paletteToThemeColors(DEFAULT_PALETTE);

const ThemeContext = createContext<ThemeColors>(DEFAULT_THEME_COLORS);
export const ThemeProvider = ThemeContext.Provider;

/**
 * The active venue theme. Falls back to the default theme when read outside a
 * ThemeProvider (e.g. the scan/discovery screens), so shared `ui.tsx`
 * components keep their exact current look everywhere.
 */
export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}

export const fontFamily = {
  display: "BricolageGrotesque_800ExtraBold",
  displaySemi: "BricolageGrotesque_700Bold",
  regular: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  arabic: "IBMPlexSansArabic_500Medium",
  arabicSemi: "IBMPlexSansArabic_600SemiBold",
  arabicBold: "IBMPlexSansArabic_700Bold",
} as const;

/**
 * Direction helpers — we mirror layouts per-language at render time
 * (instant language switch, no app restart like I18nManager.forceRTL).
 */
export function rowDir(lang: Language): ViewStyle {
  return { flexDirection: lang === "ar" ? "row-reverse" : "row" };
}

export function textDir(lang: Language): TextStyle {
  return { textAlign: lang === "ar" ? "right" : "left", writingDirection: lang === "ar" ? "rtl" : "ltr" };
}

/** Font stack per language: Arabic gets its family and a +10% size bump. */
export function faceFor(lang: Language, weight: "regular" | "semibold" | "bold" | "extrabold"): string {
  if (lang !== "ar") return fontFamily[weight];
  switch (weight) {
    case "regular":
      return fontFamily.arabic;
    case "semibold":
      return fontFamily.arabicSemi;
    default:
      return fontFamily.arabicBold;
  }
}

export function sizeFor(lang: Language, size: number): number {
  return lang === "ar" ? Math.round(size * 1.1 * 10) / 10 : size;
}

/** Display face: Bricolage for latin, bold Plex Arabic for Arabic. */
export function displayFace(lang: Language): string {
  return lang === "ar" ? fontFamily.arabicBold : fontFamily.display;
}

export const shadowCard: ViewStyle = {
  shadowColor: "#3C230F",
  shadowOpacity: 0.04,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

export const shadowCta: ViewStyle = {
  shadowColor: colors.harissa,
  shadowOpacity: 0.3,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};

export const shadowDark: ViewStyle = {
  shadowColor: colors.ink,
  shadowOpacity: 0.35,
  shadowRadius: 26,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
};
