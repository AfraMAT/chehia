import { ActivityIndicator, Pressable, View } from "react-native";
import { formatDistanceKm, interpolate } from "@chehia/shared";
import { CtaButton, T } from "../ui";
import { useI18n } from "@/lib/i18n";
import { useLocationGate } from "@/lib/location-gate";
import { colors, rowDir, useTheme } from "@/lib/theme";

/**
 * Checkout location gate (cart, browse flow). Blocks order placement until the
 * customer confirms they are within the venue's geofence. The parent renders it
 * INSTEAD of the place-order button while `applies && status !== "ok"`; once the
 * customer is confirmed on-site the parent swaps back to the normal button.
 * Mirrors the web gate copy (share → locating → here → too far → denied).
 */
export function LocationGateCard({ venueName }: { venueName: string }) {
  const gate = useLocationGate();
  const { t, lang, isRtl } = useI18n();
  const theme = useTheme();
  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };

  // Never shown once ordering is allowed; the parent guards on this too.
  if (!gate.applies || gate.status === "ok") return null;

  const d = gate.distanceM != null ? formatDistanceKm(gate.distanceM / 1000, lang) : "";

  // Per-state copy, tint and CTA. `far`/`denied` reuse warning tokens (static so
  // they read consistently across every venue theme); `share` uses venue teal.
  const view = (() => {
    switch (gate.status) {
      case "locating":
        return { glyph: "⌖", tint: theme.sandDeep, fg: theme.muted, title: t.location.gate.locating, body: "", cta: null };
      case "far":
        return {
          glyph: "⚑",
          tint: colors.warningTint,
          fg: colors.warningText,
          title: t.location.gate.tooFar,
          body: interpolate(t.location.gate.tooFarBody, { venue: venueName, d }),
          cta: t.location.gate.retry,
        };
      case "denied":
        return {
          glyph: "⚑",
          tint: colors.warningTint,
          fg: colors.warningText,
          title: t.location.gate.denied,
          body: t.location.gate.deniedBody,
          cta: t.location.gate.retry,
        };
      // idle + unsupported both invite the customer to share their location.
      default:
        return {
          glyph: "⌖",
          tint: theme.sidiBouTint,
          fg: theme.sidiBouPressed,
          title: t.location.gate.shareToOrder,
          body: interpolate(t.location.gate.shareBody, { venue: venueName }),
          cta: t.location.gate.shareCta,
        };
    }
  })();

  return (
    <View
      style={{
        backgroundColor: view.tint,
        borderRadius: 16,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={[rowDir(lang), { alignItems: "center", gap: 12 }]}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.6)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {gate.status === "locating" ? (
            <ActivityIndicator color={view.fg} />
          ) : (
            <T weight="extrabold" size={20} color={view.fg}>
              {view.glyph}
            </T>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <T lang={lang} weight="extrabold" size={15} color={view.fg} style={align}>
            {view.title}
          </T>
          {view.body ? (
            <T lang={lang} weight="semibold" size={12.5} color={view.fg} style={{ opacity: 0.85, ...align }}>
              {view.body}
            </T>
          ) : null}
        </View>
      </View>
      {view.cta && (
        <CtaButton
          lang={lang}
          height={48}
          disabled={gate.status === "locating"}
          label={view.cta}
          onPress={() => void gate.request()}
        />
      )}
    </View>
  );
}

/**
 * Compact venue-home status banner (browse flow). Self-hides when the gate does
 * not apply. Tapping requests / retries the location read. Mirrors the web
 * "share → you're here → {d} away" progression.
 */
export function LocationBanner({ venueName }: { venueName: string }) {
  const gate = useLocationGate();
  const { t, lang, isRtl } = useI18n();
  const theme = useTheme();
  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };

  if (!gate.applies) return null;

  const d = gate.distanceM != null ? formatDistanceKm(gate.distanceM / 1000, lang) : "";

  const view = (() => {
    switch (gate.status) {
      case "ok":
        // On-site: a settled confirmation, so not a call to action.
        return {
          glyph: "✓",
          tint: colors.successTint,
          fg: colors.successText,
          label: t.location.gate.here,
          press: false,
        };
      case "locating":
        return { glyph: "⌖", tint: theme.sandDeep, fg: theme.muted, label: t.location.gate.locating, press: false };
      case "far":
        return {
          glyph: "⚑",
          tint: colors.warningTint,
          fg: colors.warningText,
          label: interpolate(t.location.gate.away, { d }),
          press: true,
        };
      case "denied":
        return {
          glyph: "⚑",
          tint: colors.warningTint,
          fg: colors.warningText,
          label: t.location.gate.denied,
          press: true,
        };
      default:
        return {
          glyph: "⌖",
          tint: theme.sidiBouTint,
          fg: theme.sidiBouPressed,
          label: t.location.gate.shareToOrder,
          press: true,
        };
    }
  })();

  const inner = (
    <View
      style={[
        rowDir(lang),
        {
          marginTop: 14,
          backgroundColor: view.tint,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
          alignItems: "center",
          gap: 10,
        },
      ]}
    >
      {gate.status === "locating" ? (
        <ActivityIndicator color={view.fg} />
      ) : (
        <T weight="extrabold" size={16} color={view.fg}>
          {view.glyph}
        </T>
      )}
      <T lang={lang} weight="bold" size={13} color={view.fg} style={{ flex: 1, ...align }}>
        {view.label}
      </T>
    </View>
  );

  if (!view.press) return inner;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={view.label}
      onPress={() => void gate.request()}
    >
      {inner}
    </Pressable>
  );
}
