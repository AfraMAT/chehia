import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import type { Language } from "@chehia/shared";
import { colors, displayFace, faceFor, fontFamily, shadowCta, sizeFor } from "../lib/theme";

/** The 8-point zellige star mark. */
export function ZelligeMark({
  size = 30,
  color = colors.harissa,
  inner = "#FFFFFF",
  radius,
}: {
  size?: number;
  color?: string;
  inner?: string;
  radius?: number;
}) {
  const sq = size * 0.44;
  const squareStyle: ViewStyle = {
    position: "absolute",
    left: size / 2 - sq / 2,
    top: size / 2 - sq / 2,
    width: sq,
    height: sq,
    backgroundColor: inner,
    borderRadius: size * 0.07,
  };
  return (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: radius ?? size * 0.3 }}>
      <View style={squareStyle} />
      <View style={[squareStyle, { transform: [{ rotate: "45deg" }] }]} />
      <View
        style={{
          position: "absolute",
          left: size / 2 - size * 0.08,
          top: size / 2 - size * 0.08,
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: size * 0.08,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function Wordmark({ size = 19, color = colors.ink, dotColor = colors.harissa }: { size?: number; color?: string; dotColor?: string }) {
  return (
    <Text style={{ fontFamily: fontFamily.display, fontSize: size, color, letterSpacing: -0.4 }}>
      chahia<Text style={{ color: dotColor }}>.</Text>
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
  const base: Record<string, { bg: string; fg: string; border?: string; shadow?: ViewStyle }> = {
    primary: { bg: disabled ? colors.disabled : colors.harissa, fg: "#FFFFFF", shadow: disabled ? undefined : shadowCta },
    secondary: { bg: colors.harissaTint, fg: colors.harissaPressed },
    outline: { bg: colors.card, fg: colors.ink, border: colors.ink },
    dark: { bg: colors.ink, fg: colors.cream },
  };
  const s = base[variant] ?? base.primary!;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          height,
          borderRadius: 16,
          backgroundColor: pressed && variant === "primary" && !disabled ? colors.harissaPressed : s.bg,
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
      <Text style={{ fontFamily: faceFor(lang, "extrabold"), fontSize: sizeFor(lang, 16), color: s.fg }}>{label}</Text>
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
  const tones = {
    green: { border: colors.successBorder, fg: colors.successText, bg: "transparent" },
    amber: { border: colors.warningBorder, fg: colors.warningText, bg: "transparent" },
    neutral: { border: colors.borderStrong, fg: colors.muted, bg: "transparent" },
    popular: { border: "transparent", fg: colors.harissaPressed, bg: colors.harissaTint },
    soldout: { border: "transparent", fg: colors.mutedSoft, bg: colors.sandDeep },
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
  const h = compact ? 36 : 52;
  const w = compact ? 38 : 46;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: colors.borderStrong,
        borderRadius: 100,
        backgroundColor: "#FFFFFF",
        height: h,
      }}
    >
      <Pressable
        accessibilityLabel="minus"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={{ width: w, height: h, alignItems: "center", justifyContent: "center", opacity: value <= min ? 0.3 : 1 }}
      >
        <Text style={{ color: colors.harissa, fontFamily: fontFamily.extrabold, fontSize: compact ? 17 : 22 }}>−</Text>
      </Pressable>
      <Text style={{ width: 24, textAlign: "center", fontFamily: fontFamily.extrabold, fontSize: compact ? 14 : 17, color: colors.ink }}>
        {value}
      </Text>
      <Pressable
        accessibilityLabel="plus"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={{ width: w, height: h, alignItems: "center", justifyContent: "center", opacity: value >= max ? 0.3 : 1 }}
      >
        <Text style={{ color: colors.harissa, fontFamily: fontFamily.extrabold, fontSize: compact ? 17 : 22 }}>+</Text>
      </Pressable>
    </View>
  );
}

/** Diagonal-weave photo placeholder (design canvas style) built from stripes. */
export function PhotoPlaceholder({
  width,
  height,
  radius = 12,
  mirrored = false,
}: {
  width: number | "100%";
  height: number;
  radius?: number;
  mirrored?: boolean;
}) {
  const stripes = Array.from({ length: 30 });
  return (
    <View style={{ width, height, borderRadius: radius, backgroundColor: colors.photoPlaceholder, overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          inset: -height,
          flexDirection: "row",
          transform: [{ rotate: mirrored ? "-45deg" : "45deg" }],
        }}
      >
        {stripes.map((_, i) => (
          <View
            key={i}
            style={{ width: 7, height: height * 4, backgroundColor: i % 2 ? colors.photoPlaceholderAlt : colors.photoPlaceholder, marginRight: 7 }}
          />
        ))}
      </View>
    </View>
  );
}

export function BackButton({ onPress, isRtl = false }: { onPress: () => void; isRtl?: boolean }) {
  return (
    <Pressable
      accessibilityLabel="back"
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 17, fontFamily: fontFamily.extrabold, marginTop: -2 }}>
        {isRtl ? "›" : "‹"}
      </Text>
    </Pressable>
  );
}

export function Handle() {
  return (
    <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 }} />
  );
}

export function Line({ dashed = false, style }: { dashed?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { borderTopWidth: 1, borderColor: dashed ? colors.borderStrong : colors.border, borderStyle: dashed ? "dashed" : "solid" },
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
  color = colors.ink,
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
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: display ? displayFace(lang) : faceFor(lang, weight),
          fontSize: sizeFor(lang, size),
          color,
          lineHeight: lang === "ar" ? sizeFor(lang, size) * 1.5 : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
