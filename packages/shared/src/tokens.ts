/**
 * Chahia design tokens — "Harissa & Sidi Bou".
 * Warm terracotta (appetite, craft) × deep Mediterranean teal (trust).
 * Single source of truth for both the Expo app and the web portal.
 */

export const colors = {
  // Brand
  harissa: "#BC4B26", // primary, CTAs
  harissaPressed: "#A03D1D",
  harissaTint: "#F7E7DE",
  harissaSoft: "#E08D6B", // accents on dark
  harissaPeach: "#F2C7A8",
  sidiBou: "#10606A", // secondary, info
  sidiBouPressed: "#0B4A52",
  sidiBouTint: "#E1EEEE",

  // Neutrals (warm)
  ink: "#221A13", // encre — primary text
  muted: "#6E6257", // secondary text
  mutedSoft: "#9A8D80", // tertiary text / captions
  disabled: "#C9BFB2",
  cream: "#FAF6EF", // app background
  card: "#FFFDF9", // card surfaces
  sand: "#F6F1E8", // portal background / wells
  sandDeep: "#F1EAE0",
  border: "#EDE4D8",
  borderStrong: "#E3D9CB",
  borderDashed: "#D8CCBA",
  photoPlaceholder: "#F2E5D4",
  photoPlaceholderAlt: "#EBDCC7",

  // Semantic — order state only. Harissa is never used for errors.
  success: "#2E7D4F",
  successText: "#1F5A36",
  successTint: "#E4F0E7",
  successBorder: "#BCD8C5",
  warning: "#B97F1E",
  warningText: "#8A5E12",
  warningTint: "#F7EDDC",
  warningBorder: "#E3CFA5",
  danger: "#B02E2E",
  dangerText: "#8A2020",
  dangerTint: "#F7E3E0",

  // Kitchen display (dark by design: glare, grease, distance)
  kitchen: {
    bg: "#171310",
    card: "#211B16",
    border: "#372E26",
    borderSubtle: "#2E261F",
    text: "#F4EDE4",
    textMuted: "#B8A996",
    textSoft: "#CBB89E",
    success: "#5FBF87",
    successSoft: "#8FD9AE",
    successBorder: "#2E5A3E",
    warning: "#D9A83C",
    warningSoft: "#F1CE7E",
    danger: "#FF9D7E",
    lateBorder: "#6E3D1E",
  },
} as const;

/** Order status → visual treatment. Never color-only: always label + dot. */
export const statusColors = {
  new: { dot: colors.harissa, text: "#A03D1D", tint: colors.harissaTint, border: colors.harissa },
  preparing: { dot: colors.warning, text: colors.warningText, tint: colors.warningTint, border: colors.warningBorder },
  ready: { dot: colors.success, text: colors.successText, tint: colors.successTint, border: colors.successBorder },
  served: { dot: colors.success, text: colors.successText, tint: colors.successTint, border: colors.successBorder },
  cancelled: { dot: colors.danger, text: colors.dangerText, tint: colors.dangerTint, border: colors.dangerTint },
} as const;

export const fonts = {
  display: "Bricolage Grotesque", // headlines, prices XL, empty states
  ui: "Manrope", // everything else
  arabic: "IBM Plex Sans Arabic", // sized +10% vs latin, taller leading
} as const;

/** 4/8pt grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 9,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  sheet: 26,
  pill: 100,
} as const;

/** Thumb-friendly minimum touch target. */
export const touchTarget = 48;

/** Arabic type scales +10% relative to latin for visual balance. */
export const arabicScale = 1.1;
