import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Defs, G, Pattern, Rect } from "react-native-svg";
import type { Language, Sentiment } from "@chehia/shared";
import { useI18n } from "../lib/i18n";
import { colors, displayFace, faceFor, fontFamily, shadowCta, sizeFor, useTheme } from "../lib/theme";

const STAR_GOLD = "#E0A63C";
const STAR_EMPTY = "#E3D9CB";

/** Read-only star row with fractional fill (e.g. 4.3 → 4.3 gold stars). */
export function Stars({ value, size = 14 }: { value: number | null | undefined; size?: number }) {
  const [w, setW] = useState(0);
  const pct = Math.max(0, Math.min(1, (value ?? 0) / 5));
  return (
    <View style={{ position: "relative" }}>
      <Text
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ fontSize: size, color: STAR_EMPTY, letterSpacing: 1 }}
      >
        ★★★★★
      </Text>
      {w > 0 && (
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: w * pct, overflow: "hidden" }}>
          <Text style={{ fontSize: size, color: STAR_GOLD, letterSpacing: 1 }}>★★★★★</Text>
        </View>
      )}
    </View>
  );
}

/** Interactive 1–5 star picker with 44px targets. */
export function StarInput({ value, onChange, size = 30 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="radio"
          accessibilityState={{ selected: n === value }}
          accessibilityLabel={`${n} / 5`}
          hitSlop={4}
          onPress={() => onChange(n)}
          style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: size, color: n <= value ? STAR_GOLD : STAR_EMPTY }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Three big emoji faces for the overall visit rating. */
export function FaceInput({
  value,
  onChange,
  options,
}: {
  value: Sentiment | null;
  onChange: (s: Sentiment) => void;
  options: { key: Sentiment; emoji: string; label: string }[];
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 6,
              paddingVertical: 16,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: selected ? theme.harissa : theme.border,
              backgroundColor: selected ? theme.harissaTint : theme.card,
            }}
          >
            <Text style={{ fontSize: 38, opacity: selected ? 1 : 0.7 }}>{o.emoji}</Text>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: 13, color: selected ? theme.harissaPressed : theme.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The Chehia "Scan & Fork" mark — a QR-scan finder + a fork, echoing the app
 * icon (scan → order → eat). Matches the web brand mark (apps/web brand.tsx) so
 * the launcher icon and the in-app mark are one identity. Reduced form (single
 * finder + fork) stays legible from ~16px nav marks up. Export name kept as
 * `ZelligeMark` so every existing caller keeps working.
 */
export function ZelligeMark({
  size = 30,
  color,
  inner = "#FFFFFF",
  radius,
}: {
  size?: number;
  color?: string;
  inner?: string;
  radius?: number;
}) {
  const theme = useTheme();
  const fill = color ?? theme.harissa;
  // rx is in the 0–100 viewBox space; default 30 == size * 0.3 rounded square.
  const rx = radius != null ? (radius / size) * 100 : 30;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width={100} height={100} rx={rx} fill={fill} />
      {/* "scan" QR finder, top-left */}
      <Rect x={19} y={19} width={25} height={25} rx={7} fill="none" stroke={inner} strokeWidth={5.5} />
      <Rect x={28} y={28} width={7} height={7} rx={2} fill={inner} />
      {/* fork */}
      <G fill={inner}>
        <Rect x={52} y={40} width={4.4} height={23} rx={2.2} />
        <Rect x={59} y={40} width={4.4} height={23} rx={2.2} />
        <Rect x={66} y={40} width={4.4} height={23} rx={2.2} />
        <Rect x={52} y={59} width={18.4} height={5} rx={2.5} />
        <Rect x={59} y={62} width={4.8} height={21} rx={2.4} />
      </G>
    </Svg>
  );
}

export function Wordmark({ size = 19, color, dotColor }: { size?: number; color?: string; dotColor?: string }) {
  const theme = useTheme();
  return (
    <Text style={{ fontFamily: fontFamily.display, fontSize: size, color: color ?? theme.ink, letterSpacing: -0.4 }}>
      chehia<Text style={{ color: dotColor ?? theme.harissa }}>.</Text>
    </Text>
  );
}

/** Primary CTA button. */
export function CtaButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  lang = "fr",
  height = 54,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "dark";
  lang?: Language;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const base: Record<string, { bg: string; fg: string; border?: string; shadow?: ViewStyle }> = {
    primary: { bg: disabled ? theme.disabled : theme.harissa, fg: "#FFFFFF", shadow: disabled ? undefined : shadowCta },
    secondary: { bg: theme.harissaTint, fg: theme.harissaPressed },
    outline: { bg: theme.card, fg: theme.ink, border: theme.ink },
    dark: { bg: theme.ink, fg: theme.cream },
  };
  const s = base[variant] ?? base.primary!;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          height: Math.max(height, 44),
          borderRadius: 16,
          backgroundColor: pressed && variant === "primary" && !disabled ? theme.harissaPressed : s.bg,
          borderWidth: s.border ? 2 : 0,
          borderColor: s.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed && variant !== "primary" ? 0.85 : 1,
        },
        s.shadow,
        style,
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.4}
        style={{ fontFamily: faceFor(lang, "extrabold"), fontSize: sizeFor(lang, 16), color: s.fg }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Dietary / info tag pill. */
export function TagPill({
  label,
  tone = "neutral",
  lang = "fr",
}: {
  label: string;
  tone?: "green" | "amber" | "neutral" | "popular" | "soldout";
  lang?: Language;
}) {
  const theme = useTheme();
  const tones = {
    green: { border: colors.successBorder, fg: colors.successText, bg: "transparent" },
    amber: { border: colors.warningBorder, fg: colors.warningText, bg: "transparent" },
    neutral: { border: theme.borderStrong, fg: theme.muted, bg: "transparent" },
    popular: { border: "transparent", fg: theme.harissaPressed, bg: theme.harissaTint },
    soldout: { border: "transparent", fg: theme.mutedSoft, bg: theme.sandDeep },
  } as const;
  const s = tones[tone];
  return (
    <View
      style={{
        borderWidth: s.border === "transparent" ? 0 : 1.5,
        borderColor: s.border,
        backgroundColor: s.bg,
        borderRadius: 100,
        paddingHorizontal: 9,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontFamily: faceFor(lang, "bold"),
          fontSize: sizeFor(lang, 11),
          color: s.fg,
          textDecorationLine: tone === "soldout" ? "line-through" : "none",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Quantity stepper with 44px targets. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  compact = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const h = compact ? 36 : 52;
  const w = compact ? 38 : 46;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: theme.borderStrong,
        borderRadius: 100,
        backgroundColor: theme.card,
        height: h,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.decrease}
        hitSlop={8}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={{ width: w, height: h, alignItems: "center", justifyContent: "center", opacity: value <= min ? 0.3 : 1 }}
      >
        <Text style={{ color: theme.harissa, fontFamily: fontFamily.extrabold, fontSize: compact ? 17 : 22 }}>−</Text>
      </Pressable>
      <Text
        maxFontSizeMultiplier={1.3}
        style={{ minWidth: 24, textAlign: "center", fontFamily: fontFamily.extrabold, fontSize: compact ? 14 : 17, color: theme.ink }}
      >
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.increase}
        hitSlop={8}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={{ width: w, height: h, alignItems: "center", justifyContent: "center", opacity: value >= max ? 0.3 : 1 }}
      >
        <Text style={{ color: theme.harissa, fontFamily: fontFamily.extrabold, fontSize: compact ? 17 : 22 }}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * Photo with a diagonal-weave fallback (design canvas style). When `src` is set
 * the real image renders over the weave; a load error falls back to the weave.
 * The weave is a single SVG pattern tile (not ~30 stacked Views). Decorative →
 * hidden from screen readers.
 */
export function PhotoPlaceholder({
  width,
  height,
  radius = 12,
  mirrored = false,
  src,
}: {
  width: number | "100%";
  height: number;
  radius?: number;
  mirrored?: boolean;
  src?: string | null;
}) {
  const theme = useTheme();
  const pid = mirrored ? "weave-m" : "weave-n";
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius, backgroundColor: theme.photoPlaceholder, overflow: "hidden" }}
    >
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern
            id={pid}
            patternUnits="userSpaceOnUse"
            width={14}
            height={14}
            patternTransform={`rotate(${mirrored ? -45 : 45})`}
          >
            <Rect width={14} height={14} fill={theme.photoPlaceholder} />
            <Rect width={7} height={14} fill={theme.photoPlaceholderAlt} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={height} fill={`url(#${pid})`} />
      </Svg>
      {showImage && (
        <Image
          source={{ uri: src! }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

export function BackButton({ onPress, isRtl = false }: { onPress: () => void; isRtl?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.common.back}
      hitSlop={8}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.card,
        borderWidth: 1.5,
        borderColor: theme.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 17, fontFamily: fontFamily.extrabold, marginTop: -2 }}>
        {isRtl ? "›" : "‹"}
      </Text>
    </Pressable>
  );
}

export function Handle() {
  const theme = useTheme();
  return (
    <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.borderStrong, alignSelf: "center", marginBottom: 16 }} />
  );
}

/**
 * Visible close affordance for bottom sheets — the drag handle alone isn't an
 * obvious tap target for an older guest. Sits in the top corner (leading edge in
 * RTL), with a generous hitSlop so the real target clears 44px.
 */
export function SheetClose({ onClose, isRtl = false }: { onClose: () => void; isRtl?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.common.close}
      hitSlop={10}
      onPress={onClose}
      style={{
        position: "absolute",
        top: 10,
        right: isRtl ? undefined : 12,
        left: isRtl ? 12 : undefined,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.sandDeep,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.muted, fontFamily: fontFamily.bold, fontSize: 15 }}>✕</Text>
    </Pressable>
  );
}

export function Line({ dashed = false, style }: { dashed?: boolean; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { borderTopWidth: 1, borderColor: dashed ? theme.borderStrong : theme.border, borderStyle: dashed ? "dashed" : "solid" },
        style,
      ]}
    />
  );
}

export function T({
  children,
  lang = "fr",
  weight = "regular",
  size = 14,
  color,
  display = false,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  lang?: Language;
  weight?: "regular" | "semibold" | "bold" | "extrabold";
  size?: number;
  color?: string;
  display?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: display ? displayFace(lang) : faceFor(lang, weight),
          fontSize: sizeFor(lang, size),
          color: color ?? theme.ink,
          lineHeight: lang === "ar" ? sizeFor(lang, size) * 1.5 : undefined,
          // Arabic needs an explicit RTL base direction, otherwise a string
          // that mixes Arabic with Latin/digits (prices, table numbers) renders
          // its runs in scrambled bidi order even when right-aligned.
          writingDirection: lang === "ar" ? "rtl" : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
