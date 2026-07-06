import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LANGUAGE_LABELS, formatRating, interpolate, type Language } from "@chehia/shared";
import { CtaButton, PhotoPlaceholder, Stars, T, Wordmark, ZelligeMark } from "../ui";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { colors, rowDir, shadowCard } from "@/lib/theme";
import { useVenueState } from "@/lib/venue";
import { TablePicker } from "./table-picker";

/** P1 · Venue landing — venue + table context, language switch up front,
 * pay-at-counter reassurance. Shared by the scanned flow (fixed table) and the
 * browse flow (table picked in-session via the picker). */
export function VenueHome() {
  const { state, basePath, browse, cachedAt } = useVenueState();
  const { t, tr, lang, setLang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);

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
            {browse ? t.discover.noResults : t.landing.invalidQr}
          </T>
          <T lang={lang} weight="semibold" size={13} color={colors.muted} style={{ textAlign: "center", maxWidth: 280 }}>
            {browse ? t.discover.noResultsBody : t.landing.invalidQrBody}
          </T>
          {browse ? (
            <CtaButton
              lang={lang}
              variant="outline"
              height={46}
              style={{ marginTop: 12, alignSelf: "stretch" }}
              label={t.common.back}
              onPress={() => go("/app", "replace")}
            />
          ) : (
            <CtaButton
              lang={lang}
              height={46}
              style={{ marginTop: 12, alignSelf: "stretch" }}
              label={t.landing.scanPrompt}
              onPress={() => go("/", "replace")}
            />
          )}
        </View>
      </View>
    );
  }

  const { restaurant, tables } = state.bundle;
  const table = state.bundle.table;
  // Browse venue with no tables configured: the picker would be empty, so the
  // "choose your table" affordances are disabled with a hint instead.
  const noTables = browse && (tables?.length ?? 0) === 0;

  const closingTime = (() => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const today = restaurant.opening_hours?.[days[new Date().getDay()] as string];
    return today?.split("-")[1] ?? null;
  })();

  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        {/* Venue photo */}
        <View style={{ height: 280 }}>
          <PhotoPlaceholder width="100%" height={280} radius={0} mirrored={isRtl} src={restaurant.cover_url} />
          {browse && (
            <Pressable
              onPress={() => go("/app", "replace")}
              accessibilityRole="button"
              accessibilityLabel={t.common.back}
              style={{
                position: "absolute",
                top: insets.top + 10,
                [isRtl ? "left" : "right"]: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(34,26,19,0.82)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T weight="extrabold" size={17} color={colors.cream} style={{ marginTop: -2 }}>
                {isRtl ? "›" : "‹"}
              </T>
            </Pressable>
          )}
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
          <T lang={lang} display size={28} style={align}>
            {restaurant.name}
          </T>
          <T lang={lang} weight="semibold" size={13.5} color={colors.muted} style={{ marginTop: 2, ...align }}>
            {tr(restaurant.tagline_i18n)}
            {closingTime ? ` · ${t.landing.openUntil} ${closingTime}` : ""}
          </T>
          {(restaurant.rating_count ?? 0) > 0 && (
            <View style={[rowDir(lang), { alignItems: "center", gap: 6, marginTop: 5 }]}>
              <Stars value={restaurant.rating_avg} size={15} />
              <T lang={lang} weight="bold" size={13} color={colors.ink}>
                {formatRating(restaurant.rating_avg, lang)}
              </T>
              <T lang={lang} weight="semibold" size={12.5} color={colors.mutedSoft}>
                · {interpolate(t.rating.ratingsCount, { count: restaurant.rating_count ?? 0 })}
              </T>
            </View>
          )}

          {/* Table card (scanned or already picked) — or a pick prompt (browse) */}
          {table ? (
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
                <T lang={lang} weight="extrabold" size={15} style={align}>
                  {t.common.table} {table.label}
                  {table.zone ? ` · ${table.zone}` : ""}
                </T>
                <T lang={lang} weight="semibold" size={12.5} color={colors.muted} style={align}>
                  {t.landing.tableContext}
                </T>
              </View>
              {browse && (
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t.landing.changeTable}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={{ backgroundColor: colors.harissaTint, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 }}
                >
                  <T lang={lang} weight="bold" size={13} color={colors.harissaPressed}>
                    {t.landing.changeTable}
                  </T>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              disabled={noTables}
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityState={{ disabled: noTables }}
              accessibilityLabel={noTables ? t.landing.noTables : t.landing.chooseTable}
              style={[
                rowDir(lang),
                {
                  marginTop: 16,
                  backgroundColor: colors.card,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: colors.borderStrong,
                  borderRadius: 16,
                  padding: 14,
                  alignItems: "center",
                  gap: 12,
                  opacity: noTables ? 0.6 : 1,
                },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.sidiBouTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T weight="extrabold" size={20} color={colors.sidiBouPressed}>
                  ⌖
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T lang={lang} weight="extrabold" size={15} style={align}>
                  {noTables ? t.landing.noTables : t.landing.chooseTable}
                </T>
                {!noTables && (
                  <T lang={lang} weight="semibold" size={12.5} color={colors.muted} style={align}>
                    {t.landing.chooseTableBody}
                  </T>
                )}
              </View>
              {!noTables && (
                <T weight="extrabold" size={16} color={colors.mutedSoft}>
                  {isRtl ? "‹" : "›"}
                </T>
              )}
            </Pressable>
          )}

          {/* Cached-menu note (offline) */}
          {cachedAt && (
            <T lang={lang} weight="semibold" size={12} color={colors.mutedSoft} style={{ marginTop: 10, ...align }}>
              {t.offline.menuAvailable}
            </T>
          )}

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
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={LANGUAGE_LABELS[code]}
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

          {browse && !table ? (
            <View style={{ gap: 10 }}>
              <CtaButton
                lang={lang}
                height={56}
                disabled={noTables}
                label={t.landing.chooseTable}
                onPress={() => setPickerOpen(true)}
              />
              <CtaButton
                lang={lang}
                variant="outline"
                height={48}
                label={t.landing.justBrowsing}
                onPress={() => go(`${basePath}/menu`)}
              />
            </View>
          ) : (
            <CtaButton lang={lang} height={56} label={t.landing.viewMenu} onPress={() => go(`${basePath}/menu`)} />
          )}
        </View>
      </ScrollView>

      {pickerOpen && <TablePicker onClose={() => setPickerOpen(false)} />}
    </View>
  );
}
