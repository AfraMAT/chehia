import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  foldSearch,
  buildCategoryTree,
  cartCount,
  cartTotal,
  currencyLabel,
  descendantCategoryIds,
  interpolate,
  millimesToDisplay,
  resolveAppearance,
  type CategoryNode,
  type Language,
  type MenuItem,
} from "@chehia/shared";
import { T, ZelligeMark } from "../ui";
import { useI18n } from "@/lib/i18n";
import { go } from "@/lib/nav";
import { rowDir, shadowDark, useTheme } from "@/lib/theme";
import { useVenue } from "@/lib/venue";
import { ItemSheet } from "./item-sheet";
import { ItemCard } from "./item-card";
import { CategoryLanding } from "./category-landing";
import { CategoryItems } from "./category-items";
import { WaiterSheet } from "./waiter-sheet";
import { OfflineBanner } from "./offline-banner";
import { GroupEntry } from "./group/group-entry";

/**
 * P2 · Menu — category-first landing (venue-selectable layout) that drills into
 * items, or the classic pills+list view. Search always flattens across the whole
 * menu. Theme comes from the venue's runtime appearance. Group ordering entry
 * self-hides off a scanned table. Render only under a "ready" venue guard.
 */
export function MenuScreen() {
  const venue = useVenue();
  const { restaurant, table, categories, items, groupsByItem, cart, basePath, activeOrders, lastOrder, reorderLast } = venue;
  const { t, tr, lang, setLang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const appearance = useMemo(() => resolveAppearance(restaurant.appearance), [restaurant.appearance]);
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const itemCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) map[it.category_id] = (map[it.category_id] ?? 0) + 1;
    return map;
  }, [items]);

  // Category-first landing unless the venue opted for classic, turned it off, or
  // there is only one top-level category (a landing would be pointless).
  const useLanding = appearance.showCategoryLanding && appearance.categoryLayout !== "classic" && tree.length > 1;

  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(tree[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [waiterOpen, setWaiterOpen] = useState(false);

  const selectedRoot: CategoryNode | null = useMemo(
    () => (selectedRootId ? tree.find((n) => n.id === selectedRootId) ?? null : null),
    [selectedRootId, tree],
  );

  // Android hardware back returns from a category to the landing, not off-screen.
  useEffect(() => {
    if (!selectedRootId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelectedRootId(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedRootId]);

  const onMenuItems = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return items.filter((i) => ids.has(i.category_id));
  }, [items, categories]);

  const searching = search.trim().length > 0;

  const searchResults = useMemo(() => {
    const q = foldSearch(search.trim());
    if (!q) return [];
    return onMenuItems.filter((i) =>
      Object.values(i.name_i18n)
        .concat(Object.values(i.description_i18n))
        .some((s) => s && foldSearch(s).includes(q)),
    );
  }, [onMenuItems, search]);

  // Classic mode: items of the active top-level category + its subcategories.
  const classicItems = useMemo(() => {
    const node = tree.find((n) => n.id === activeCategory);
    if (!node) return onMenuItems.filter((i) => i.category_id === activeCategory);
    const ids = new Set(descendantCategoryIds(node));
    return onMenuItems.filter((i) => ids.has(i.category_id));
  }, [tree, activeCategory, onMenuItems]);

  const count = cartCount(cart);
  const cards = appearance.itemLayout === "cards";
  const padBottom = count > 0 ? 96 : 24;

  // In-flow language switch: cycle through the venue's supported languages
  // without leaving the menu (the landing-screen pills stay the full picker).
  const supportedLangs = useMemo(() => {
    const langs = ((restaurant.languages ?? []) as Language[]).filter((l) => ["fr", "ar", "en"].includes(l));
    return langs.length > 0 ? langs : (["fr", "ar", "en"] as Language[]);
  }, [restaurant.languages]);
  const nextLang = supportedLangs[(supportedLangs.indexOf(lang) + 1) % supportedLangs.length] ?? supportedLangs[0]!;
  const langShort = { fr: "FR", ar: "ع", en: "EN" } as const;

  const emptyState = (
    <View style={{ alignItems: "center", paddingVertical: 60, gap: 6 }}>
      <T lang={lang} display size={20}>
        {t.menu.noResults}
      </T>
      <T lang={lang} weight="semibold" size={13} color={theme.muted}>
        {t.menu.noResultsBody}
      </T>
    </View>
  );

  // A flat item list in the venue's item layout (shared by search + classic).
  const itemList = (data: MenuItem[]) => (
    <FlatList
      key={appearance.itemLayout}
      data={data}
      keyExtractor={(item) => item.id}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      numColumns={cards ? 2 : 1}
      columnWrapperStyle={cards ? { gap: 10, paddingHorizontal: 20 } : undefined}
      contentContainerStyle={
        cards
          ? { paddingTop: 10, paddingBottom: padBottom, gap: 10 }
          : { paddingHorizontal: 20, paddingTop: 10, paddingBottom: padBottom, gap: 10 }
      }
      ListEmptyComponent={emptyState}
      renderItem={({ item }) => (
        <ItemCard
          item={item}
          groups={groupsByItem[item.id] ?? []}
          layout={appearance.itemLayout}
          onOpen={setOpenItem}
          style={cards ? { flex: 1, maxWidth: "50%" } : undefined}
        />
      )}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream, paddingTop: insets.top }}>
      <OfflineBanner />

      {/* Header */}
      <View style={[rowDir(lang), { alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} hitSlop={10} onPress={() => router.back()}>
          <ZelligeMark size={30} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T lang={lang} weight="extrabold" size={16} numberOfLines={1} style={{ textAlign: isRtl ? "right" : "left" }}>
            {restaurant.name}
          </T>
          <T lang={lang} weight="semibold" size={11.5} color={theme.mutedSoft} numberOfLines={1} style={{ textAlign: isRtl ? "right" : "left" }}>
            {t.menu.title} · {lang === "fr" ? "Français" : lang === "ar" ? "العربية" : "English"}
          </T>
        </View>
        {supportedLangs.length > 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.language}
            onPress={() => setLang(nextLang)}
            hitSlop={8}
            style={{
              height: 40,
              minWidth: 40,
              paddingHorizontal: 6,
              borderRadius: 20,
              backgroundColor: theme.card,
              borderWidth: 1.5,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T weight="extrabold" size={12.5} color={theme.ink}>
              {langShort[lang]}
            </T>
          </Pressable>
        )}
        {table && (
          <View style={{ backgroundColor: theme.harissaTint, borderRadius: 100, paddingVertical: 7, paddingHorizontal: 12 }}>
            <T lang={lang} weight="extrabold" size={13} color={theme.harissaPressed}>
              {t.common.table} {table.label}
            </T>
          </View>
        )}
        {table && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.waiter.call}
            onPress={() => setWaiterOpen(true)}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.card,
              borderWidth: 1.5,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T size={17}>🔔</T>
          </Pressable>
        )}
      </View>

      {/* Return to orders placed from this device (most recent first; the order
          screen links across the rest of the meal's sends) */}
      {activeOrders.length > 0 && (
        <Pressable
          onPress={() => go(`${basePath}/order/${activeOrders[0]!.id}`)}
          accessibilityRole="button"
          accessibilityLabel={activeOrders.length > 1 ? interpolate(t.order.inProgressMany, { count: activeOrders.length }) : t.order.inProgress}
          style={[
            rowDir(lang),
            shadowDark,
            {
              marginHorizontal: 20,
              marginTop: 12,
              backgroundColor: theme.ink,
              borderRadius: 14,
              paddingVertical: 11,
              paddingHorizontal: 16,
              alignItems: "center",
              gap: 10,
            },
          ]}
        >
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.harissa }} />
          <T lang={lang} weight="extrabold" size={13.5} color={theme.cream} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            {activeOrders.length > 1 ? interpolate(t.order.inProgressMany, { count: activeOrders.length }) : t.order.inProgress}
          </T>
          <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 }}>
            <T lang={lang} weight="extrabold" size={13} color={theme.cream}>
              {t.order.trackOrder} {isRtl ? "‹" : "›"}
            </T>
          </View>
        </Pressable>
      )}

      {/* Group ordering entry (scanned tables only; self-hides otherwise) */}
      <GroupEntry style={{ marginHorizontal: 20, marginTop: 12 }} />

      {/* "Order my usual again" — a regular's one-tap reorder (cart empty only) */}
      {lastOrder && lastOrder.length > 0 && count === 0 && (
        <Pressable
          onPress={reorderLast}
          accessibilityRole="button"
          accessibilityLabel={t.menu.reorderUsual}
          style={[
            rowDir(lang),
            {
              marginHorizontal: 20,
              marginTop: 12,
              alignItems: "center",
              gap: 8,
              backgroundColor: theme.harissaTint,
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 14,
            },
          ]}
        >
          <T size={15}>↺</T>
          <T lang={lang} weight="extrabold" size={13.5} color={theme.harissaPressed} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            {t.menu.reorderUsual}
          </T>
          <T lang={lang} weight="bold" size={12} color={theme.harissaPressed}>
            {lastOrder.reduce((s, l) => s + l.qty, 0)} {t.common.items}
          </T>
        </Pressable>
      )}

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <View
          style={[
            rowDir(lang),
            {
              height: 46,
              borderRadius: 14,
              backgroundColor: theme.card,
              borderWidth: 1.5,
              borderColor: theme.border,
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
            },
          ]}
        >
          <T size={14} color={theme.mutedSoft}>
            ⌕
          </T>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.menu.searchPlaceholder}
            placeholderTextColor={theme.mutedSoft}
            style={{
              flex: 1,
              fontFamily: "Manrope_500Medium",
              fontSize: 14,
              color: theme.ink,
              textAlign: isRtl ? "right" : "left",
            }}
          />
        </View>
      </View>

      {/* Classic category pills (hidden while searching or in the landing) */}
      {!searching && !useLanding && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // RTL: mirror the scroll container and un-mirror each pill.
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, flexDirection: "row" }}
            style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
          >
            {tree.map((cat) => {
              const active = cat.id === activeCategory;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tr(cat.name_i18n)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={[
                    isRtl ? { transform: [{ scaleX: -1 }] } : undefined,
                    {
                      height: 38,
                      paddingHorizontal: 16,
                      borderRadius: 100,
                      backgroundColor: active ? theme.ink : theme.card,
                      borderWidth: active ? 0 : 1.5,
                      borderColor: theme.border,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <T lang={lang} weight={active ? "extrabold" : "bold"} size={13.5} color={active ? theme.cream : theme.muted}>
                    {tr(cat.name_i18n)}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Content region */}
      {searching ? (
        <View style={{ flex: 1, marginTop: 10 }}>{itemList(searchResults)}</View>
      ) : useLanding && selectedRoot ? (
        <CategoryItems
          node={selectedRoot}
          items={onMenuItems}
          groupsByItem={groupsByItem}
          itemLayout={appearance.itemLayout}
          onBack={() => setSelectedRootId(null)}
          onOpen={setOpenItem}
          bottomPad={padBottom}
        />
      ) : useLanding ? (
        <CategoryLanding
          tree={tree}
          layout={appearance.categoryLayout}
          itemCountByCategory={itemCountByCategory}
          onSelect={(node) => setSelectedRootId(node.id)}
          bottomPad={padBottom}
        />
      ) : (
        <View style={{ flex: 1 }}>{itemList(classicItems)}</View>
      )}

      {/* Persistent cart bar (personal cart; group items live in the group cart) */}
      {count > 0 && (
        <Pressable
          onPress={() => go(`${basePath}/cart`)}
          accessibilityRole="button"
          accessibilityLabel={`${t.menu.viewCart} — ${count} ${t.common.items}, ${millimesToDisplay(cartTotal(cart), lang)} ${currencyLabel(lang)}`}
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
              backgroundColor: theme.ink,
              alignItems: "center",
              paddingStart: 16,
              paddingEnd: 8,
              gap: 12,
            },
          ]}
        >
          <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: theme.harissa, alignItems: "center", justifyContent: "center" }}>
            <T weight="extrabold" size={13} color="#FFFFFF">
              {count}
            </T>
          </View>
          <T lang={lang} weight="extrabold" size={15} color={theme.cream} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            {t.menu.viewCart}
          </T>
          <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14 }}>
            <T weight="extrabold" size={15} color={theme.cream}>
              {millimesToDisplay(cartTotal(cart), lang)} {currencyLabel(lang)}
            </T>
          </View>
        </Pressable>
      )}

      {/* P3 · Item sheet */}
      {openItem && <ItemSheet item={openItem} onClose={() => setOpenItem(null)} />}
      {waiterOpen && <WaiterSheet onClose={() => setWaiterOpen(false)} />}
    </View>
  );
}
