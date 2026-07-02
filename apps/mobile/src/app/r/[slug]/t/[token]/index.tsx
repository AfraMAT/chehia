import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LANGUAGE_LABELS, type Language } from "@chehia/shared";
import { CtaButton, PhotoPlaceholder, T, Wordmark, ZelligeMark } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir, shadowCard } from "@/lib/theme";
import { useVenueState } from "@/lib/venue";

/** P1 · Scan landing — venue + table context, language switch up front. */
export default function ScanLanding() {
  const { state } = useVenueState();
  const { t, tr, lang, setLang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const { slug, token } = useLocalSearchParams<{ slug: string; token: string }>();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.harissa} size="large" />
      </View>
    );
  }

  if (state.status === "invalid") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, backgroundColor: colors.cream }}>
        <ZelligeMark size={64} />
        <View style={{ alignItems: "center", gap: 6 }}>
          <T lang={lang} display size={22} style={{ textAlign: "center" }}>
            {t.landing.invalidQr}
          </T>
          <T lang={lang} weight="semibold" size={13} color={colors.muted} style={{ textAlign: "center", maxWidth: 280 }}>
            {t.landing.invalidQrBody}
          </T>
        </View>
      </View>
    );
  }

  const { restaurant, table } = state.bundle;

  const closingTime = (() => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const today = restaurant.opening_hours?.[days[new Date().getDay()] as string];
    return today?.split("-")[1] ?? null;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        {/* Venue photo */}
        <View style={{ height: 280 }}>
          <PhotoPlaceholder width="100%" height={280} radius={0} mirrored={isRtl} />
          <View
            style={[
              rowDir(lang),
              {
                position: "absolute",
                top: insets.top + 10,
                [isRtl ? "right" : "left"]: 16,
                alignItems: "center",
                gap: 7,
                backgroundColor: "rgba(34,26,19,0.82)",
                borderRadius: 100,
                paddingVertical: 7,
                paddingHorizontal: 12,
              },
            ]}
          >
            <ZelligeMark size={20} radius={6} />
            <Wordmark size={13} color={colors.cream} dotColor={colors.harissaSoft} />
          </View>
        </View>

        {/* Sheet */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.cream,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            marginTop: -28,
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <T lang={lang} display size={28} style={{ textAlign: isRtl ? "right" : "left" }}>
            {restaurant.name}
          </T>
          <T lang={lang} weight="semibold" size={13.5} color={colors.muted} style={{ marginTop: 2, textAlign: isRtl ? "right" : "left" }}>
            {tr(restaurant.tagline_i18n)}
            {closingTime ? ` · ${t.landing.openUntil} ${closingTime}` : ""}
          </T>

          {/* Table card */}
          <View
            style={[
              rowDir(lang),
              shadowCard,
              {
                marginTop: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 14,
                alignItems: "center",
                gap: 12,
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.harissaTint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T display size={17} color={colors.harissaPressed}>
                {table.label || "?"}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T lang={lang} weight="extrabold" size={15} style={{ textAlign: isRtl ? "right" : "left" }}>
                {t.common.table} {table.label}
                {table.zone ? ` · ${table.zone}` : ""}
              </T>
              <T lang={lang} weight="semibold" size={12.5} color={colors.muted} style={{ textAlign: isRtl ? "right" : "left" }}>
                {t.landing.tableContext}
              </T>
            </View>
          </View>

          {/* Language switch */}
          <View style={{ marginTop: 20, gap: 8 }}>
            <T weight="bold" size={12} color={colors.mutedSoft} style={{ letterSpacing: 0.5, textAlign: isRtl ? "right" : "left" }}>
              LANGUE · اللغة
            </T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(restaurant.languages as Language[]).map((code) => {
                const active = lang === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setLang(code)}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: active ? colors.ink : "transparent",
                      borderWidth: active ? 0 : 1.5,
                      borderColor: colors.borderStrong,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <T lang={code} weight={active ? "extrabold" : "bold"} size={14} color={active ? colors.cream : colors.ink}>
                      {LANGUAGE_LABELS[code]}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 28 }} />

          {/* Pay at counter + CTA */}
          <View style={[rowDir(lang), { alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }]}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.sidiBou }} />
            <T lang={lang} weight="semibold" size={13} color={colors.sidiBouPressed}>
              {t.landing.payAtCounter}
            </T>
          </View>
          <CtaButton
            lang={lang}
            height={56}
            label={t.landing.viewMenu}
            onPress={() => router.push(`/r/${slug}/t/${token}/menu`)}
          />
        </View>
      </ScrollView>
    </View>
  );
}
