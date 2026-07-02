import { View } from "react-native";
import { T } from "../ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir } from "@/lib/theme";
import { useVenueState } from "@/lib/venue";

/** P8 · Poor-connection banner + cached-menu indicator. */
export function OfflineBanner() {
  const { online, cachedAt } = useVenueState();
  const { t, lang, isRtl } = useI18n();
  if (online && !cachedAt) return null;
  return (
    <View
      style={[
        rowDir(lang),
        {
          marginHorizontal: 16,
          marginTop: 12,
          backgroundColor: colors.warningTint,
          borderWidth: 1.5,
          borderColor: colors.warningBorder,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 15,
          alignItems: "center",
          gap: 11,
        },
      ]}
    >
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.warning }} />
      <View style={{ flex: 1 }}>
        <T lang={lang} weight="extrabold" size={13.5} color={colors.warningText} style={{ textAlign: isRtl ? "right" : "left" }}>
          {t.offline.unstable}
        </T>
        <T lang={lang} weight="semibold" size={12} color={colors.warningText} style={{ opacity: 0.8, textAlign: isRtl ? "right" : "left" }}>
          {cachedAt
            ? `${t.offline.cached} · ${new Date(cachedAt).toLocaleTimeString().slice(0, 5)}`
            : t.offline.menuAvailable}
        </T>
      </View>
    </View>
  );
}
