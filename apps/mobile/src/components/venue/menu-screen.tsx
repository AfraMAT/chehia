import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cartCount,
  cartTotal,
  currencyLabel,
  millimesToDisplay,
  type MenuItem,
} from "@chehia/shared";
import { PhotoPlaceholder, T, TagPill, ZelligeMark } from "../ui";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { colors, rowDir, shadowDark } from "@/lib/theme";
import { useVenue } from "@/lib/venue";
import { ItemSheet } from "./item-sheet";
import { OfflineBanner } from "./offline-banner";

/**
 * P2/P7 · Menu — category pills, dietary tags, 86'd items visible, persistent
 * cart bar. Shared by the scanned and browse flows; the cart route is derived
 * from the provider's basePath. Render only under a "ready" venue guard.
 */
export function MenuScreen() {
  const venue = useVenue();
  const { restaurant, table, categories, items, groupsByItem, cart, basePath, activeOrder } = venue;
  const { t, tr, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);

  const visibleItems = useMemo(() => {
    // Only items in active categories are on the menu — search included.
    const activeCategoryIds = new Set(categories.map((c) => c.id));
    const onMenu = items.filter((i) => activeCategoryIds.has(i.category_id));
    const q = search.trim().toLowerCase();
    if (q) {
      return onMenu.filter((i) =>
        Object.values(i.name_i18n)
          .concat(Object.values(i.description_i18n))
          .some((s) => s?.toLowerCase().includes(q)),
      );
    }
    return onMenu.filter((i) => i.category_id === activeCategory);
  }, [items, categories, activeCategory, search]);

  const count = cartCount(cart);

  const dietaryTag = (tag: string): { label: string; tone: "green" | "amber" | "neutral" } | null => {
    switch (tag) {
      case "vegetarian":
        return { label: t.dietary.vegetarian, tone: "green" };
      case "vegan":
        return { label: t.dietary.vegan, tone: "green" };
      case "spicy":
        return { label: t.dietary.spicy, tone: "amber" };
      case "gluten-free":
        return { label: t.dietary.glutenFree, tone: "neutral" };
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
      <OfflineBanner />

      {/* Header */}
      <View style={[rowDir(lang), { alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => router.back()}>
          <ZelligeMark size={30} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T lang={lang} weight="extrabold" size={16} numberOfLines={1} style={{ textAlign: isRtl ? "right" : "left" }}>
            {restaurant.name}
          </T>
          <T lang={lang} weight="semibold" size={11.5} color={colors.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
            {t.menu.title} · {lang === "fr" ? "Français" : lang === "ar" ? "العربية" : "English"}
          </T>
        </View>
        {/* Table pill: known in the scanned flow; only after picking in browse. */}
        {table && (
          <View style={{ backgroundColor: colors.harissaTint, borderRadius: 100, paddingVertical: 7, paddingHorizontal: 12 }}>
            <T lang={lang} weight="extrabold" size={13} color={colors.harissaPressed}>
              {t.common.table} {table.label}
            </T>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <View
          style={[
            rowDir(lang),
            {
              height: 46,
              borderRadius: 14,
              backgroundColor: "#FFFFFF",
              borderWidth: 1.5,
              borderColor: colors.border,
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
            },
          ]}
        >
          <T size={14} color={colors.mutedSoft}>
            ⌕
          </T>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.menu.searchPlaceholder}
            placeholderTextColor={colors.mutedSoft}
            style={{
              flex: 1,
              fontFamily: "Manrope_500Medium",
              fontSize: 14,
              color: colors.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          />
        </View>
      </View>

      {/* Category pills */}
      {!search && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // RTL: mirror the scroll container and un-mirror each pill —
            // keeps natural item order while scrolling starts from the right.
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, flexDirection: "row" }}
            style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
          >
            {categories.map((cat) => {
              const active = cat.id === activeCategory;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.id)}
                  style={[
                    isRtl ? { transform: [{ scaleX: -1 }] } : undefined,
                    {
                      height: 38,
                      paddingHorizontal: 16,
                      borderRadius: 100,
                      backgroundColor: active ? colors.ink : "#FFFFFF",
                      borderWidth: active ? 0 : 1.5,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <T lang={lang} weight={active ? "extrabold" : "bold"} size={13.5} color={active ? colors.cream : colors.muted}>
                    {tr(cat.name_i18n)}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Return to an order placed from this device */}
      {activeOrder && (
        <Pressable
          onPress={() => go(`${basePath}/order/${activeOrder.id}`)}
          accessibilityRole="button"
          accessibilityLabel={t.order.inProgress}
          style={[
            rowDir(lang),
            shadowDark,
            {
              marginHorizontal: 20,
              marginTop: 12,
              backgroundColor: colors.ink,
              borderRadius: 14,
              paddingVertical: 11,
              paddingHorizontal: 16,
              alignItems: "center",
              gap: 10,
            },
          ]}
        >
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.harissa }} />
          <T lang={lang} weight="extrabold" size={13.5} color={colors.cream} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            {t.order.inProgress}
          </T>
          <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 }}>
            <T lang={lang} weight="extrabold" size={13} color={colors.cream}>
              {t.order.trackOrder} {isRtl ? "‹" : "›"}
            </T>
          </View>
        </Pressable>
      )}

      {/* Items */}
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: count > 0 ? 96 : 24, gap: 10 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 60, gap: 6 }}>
            <T lang={lang} display size={20}>
              {t.menu.noResults}
            </T>
            <T lang={lang} weight="semibold" size={13} color={colors.muted}>
              {t.menu.noResultsBody}
            </T>
          </View>
        }
        renderItem={({ item }) => {
          const available = item.is_available;
          const sizeGroup = (groupsByItem[item.id] ?? []).find((g) => g.min_select >= 1);
          return (
            <Pressable
              disabled={!available}
              onPress={() => setOpenItem(item)}
              style={[
                rowDir(lang),
                {
                  backgroundColor: available ? "#FFFFFF" : colors.sand,
                  borderWidth: item.is_popular && available ? 1.5 : 1,
                  borderColor: item.is_popular && available ? colors.harissa : colors.border,
                  borderRadius: 16,
                  padding: 12,
                  gap: 12,
                  alignItems: "center",
                  opacity: available ? 1 : 0.66,
                },
              ]}
            >
              <View>
                <PhotoPlaceholder width={68} height={68} mirrored={isRtl} />
                {item.is_popular && available && (
                  <View
                    style={{
                      position: "absolute",
                      top: -7,
                      [isRtl ? "right" : "left"]: -7,
                      backgroundColor: colors.harissa,
                      borderRadius: 100,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <T lang={lang} weight="extrabold" size={10} color="#FFFFFF">
                      {t.menu.popular}
                    </T>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={[rowDir(lang), { justifyContent: "space-between", gap: 8 }]}>
                  <T
                    lang={lang}
                    weight="extrabold"
                    size={15.5}
                    color={available ? colors.ink : colors.muted}
                    style={{ textDecorationLine: available ? "none" : "line-through", flexShrink: 1 }}
                  >
                    {tr(item.name_i18n)}
                  </T>
                  <T weight={available ? "extrabold" : "bold"} size={available ? 15.5 : 13} color={available ? colors.ink : colors.mutedSoft}>
                    {millimesToDisplay(item.price_millimes, lang)}{" "}
                    <T size={11} color={colors.mutedSoft} lang={lang}>
                      {currencyLabel(lang)}
                    </T>
                  </T>
                </View>
                {available ? (
                  <>
                    <T lang={lang} size={12.5} color={colors.muted} numberOfLines={2} style={{ textAlign: isRtl ? "right" : "left" }}>
                      {tr(item.description_i18n)}
                    </T>
                    <View style={[rowDir(lang), { gap: 5, marginTop: 2, flexWrap: "wrap" }]}>
                      {item.dietary_tags.slice(0, 2).map((tag) => {
                        const d = dietaryTag(tag);
                        return d ? <TagPill key={tag} lang={lang} label={d.label} tone={d.tone} /> : null;
                      })}
                      {sizeGroup && <TagPill lang={lang} label={`${sizeGroup.modifiers.length} ${t.menu.sizes}`} tone="neutral" />}
                    </View>
                  </>
                ) : (
                  <View style={[rowDir(lang)]}>
                    <TagPill lang={lang} label={t.menu.soldOut} tone="soldout" />
                  </View>
                )}
              </View>
              {available && (
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: item.is_popular ? colors.harissa : colors.harissaTint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T weight="extrabold" size={21} color={item.is_popular ? "#FFFFFF" : colors.harissaPressed}>
                    +
                  </T>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {/* Persistent cart bar */}
      {count > 0 && (
        <Pressable
          onPress={() => go(`${basePath}/cart`)}
          style={[
            rowDir(lang),
            shadowDark,
            {
              position: "absolute",
              bottom: insets.bottom + 10,
              left: 16,
              right: 16,
              height: 58,
              borderRadius: 18,
              backgroundColor: colors.ink,
              alignItems: "center",
              paddingStart: 16,
              paddingEnd: 8,
              gap: 12,
            },
          ]}
        >
          <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: colors.harissa, alignItems: "center", justifyContent: "center" }}>
            <T weight="extrabold" size={13} color="#FFFFFF">
              {count}
            </T>
          </View>
          <T lang={lang} weight="extrabold" size={15} color={colors.cream} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            {t.menu.viewCart}
          </T>
          <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14 }}>
            <T weight="extrabold" size={15} color={colors.cream}>
              {millimesToDisplay(cartTotal(cart), lang)} {currencyLabel(lang)}
            </T>
          </View>
        </Pressable>
      )}

      {/* P3 · Item sheet */}
      {openItem && <ItemSheet item={openItem} onClose={() => setOpenItem(null)} />}
    </View>
  );
}
