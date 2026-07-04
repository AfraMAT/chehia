import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, T, Wordmark, ZelligeMark } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir, textDir } from "@/lib/theme";

/**
 * About & Privacy — an in-app, discoverable privacy policy + data statement,
 * required by both app stores. Chehia is anonymous (no accounts), so this also
 * doubles as the "account/data" disclosure. Reached from the scan home footer.
 */
export default function AboutScreen() {
  const { t, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top + 8 }}>
      <View style={[rowDir(lang), { alignItems: "center", gap: 12, paddingHorizontal: 20, marginBottom: 4 }]}>
        <BackButton onPress={() => router.back()} isRtl={isRtl} />
        <T lang={lang} weight="extrabold" size={18} color={colors.ink}>
          {t.about.title}
        </T>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 22, paddingBottom: insets.bottom + 48 }}>
        <View style={{ alignItems: "center", gap: 10, marginTop: 8, marginBottom: 4 }}>
          <ZelligeMark size={64} radius={18} />
          <Wordmark size={30} />
        </View>

        <T lang={lang} weight="semibold" size={15} color={colors.muted} style={[textDir(lang), { lineHeight: 25 }]}>
          {t.about.anonymous}
        </T>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t.about.privacy}
          onPress={() => void WebBrowser.openBrowserAsync("https://chehia.app/legal/privacy").catch(() => {})}
          hitSlop={6}
          style={[
            rowDir(lang),
            {
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 16,
              paddingHorizontal: 18,
              minHeight: 52,
            },
          ]}
        >
          <T lang={lang} weight="bold" size={15} color={colors.ink}>
            {t.about.privacy}
          </T>
          <T weight="extrabold" size={18} color={colors.harissa}>
            {isRtl ? "‹" : "›"}
          </T>
        </Pressable>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t.about.contact}
          onPress={() =>
            void Linking.openURL("mailto:contact@aframat.com").catch(() => Alert.alert(t.about.contact))
          }
          hitSlop={8}
          style={{ paddingVertical: 4 }}
        >
          <T lang={lang} weight="semibold" size={13} color={colors.mutedSoft} style={textDir(lang)}>
            {t.about.contact}
          </T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
