import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CtaButton, T, ZelligeMark } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { colors } from "@/lib/theme";

/**
 * Branded catch-all for malformed or truncated deep links (a mistyped /r URL,
 * a half-copied invite…). Without it, expo-router cold-starts into its
 * unbranded "Unmatched route" developer screen.
 */
export default function NotFound() {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.cream,
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 32,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <ZelligeMark size={64} />
      <View style={{ alignItems: "center", gap: 6 }}>
        <T lang={lang} display size={22} style={{ textAlign: "center" }}>
          {t.landing.invalidQr}
        </T>
        <T lang={lang} weight="semibold" size={13} color={colors.muted} style={{ textAlign: "center", maxWidth: 280 }}>
          {t.landing.invalidQrBody}
        </T>
      </View>
      <CtaButton lang={lang} height={50} style={{ alignSelf: "stretch" }} label={t.common.back} onPress={() => go("/", "replace")} />
    </View>
  );
}
