import { colors, radius, spacing } from "@chehia/shared";
import type { Language } from "@chehia/shared";
import type { TextStyle, ViewStyle } from "react-native";

export { colors, radius, spacing };

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
