import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { CategoryNode, ItemLayout, Language, MenuItem, ModifierGroup } from "@chehia/shared";
import { T } from "../ui";
import { ItemCard } from "./item-card";
import { useI18n } from "@/lib/i18n";
import { rowDir, useTheme } from "@/lib/theme";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Items of a selected top-level category, grouped by its subcategories (Epic 1). */
export function CategoryItems({
  node,
  items,
  groupsByItem,
  itemLayout,
  onBack,
  onOpen,
}: {
  node: CategoryNode;
  items: MenuItem[];
  groupsByItem: Record<string, ModifierGroup[]>;
  itemLayout: ItemLayout;
  onBack: () => void;
  onOpen: (item: MenuItem) => void;
}) {
  const { t, tr, lang, isRtl } = useI18n();
  const theme = useTheme();
  const [activeSub, setActiveSub] = useState<string | null>(null);

  const itemsByCategory = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const it of items) (map[it.category_id] ??= []).push(it);
    return map;
  }, [items]);

  const ownItems = itemsByCategory[node.id] ?? [];
  const hasSubs = node.children.length > 0;

  // Sections: the category's own items, then one per non-empty subcategory.
  const sections = [
    ...(ownItems.length ? [{ id: node.id, name: null as string | null, list: ownItems }] : []),
    ...node.children.map((sub) => ({ id: sub.id, name: tr(sub.name_i18n), list: itemsByCategory[sub.id] ?? [] })),
  ].filter((s) => s.list.length > 0);

  const visibleSections = activeSub ? sections.filter((s) => s.id === activeSub) : sections;

  const renderItems = (list: MenuItem[]) => {
    if (itemLayout === "cards") {
      return chunk(list, 2).map((row, ri) => (
        <View key={ri} style={[rowDir(lang), { gap: 10 }]}>
          {row.map((it) => (
            <ItemCard key={it.id} item={it} groups={groupsByItem[it.id] ?? []} layout="cards" onOpen={onOpen} style={{ flex: 1 }} />
          ))}
          {row.length < 2 && <View style={{ flex: 1 }} />}
        </View>
      ));
    }
    return list.map((it) => (
      <ItemCard key={it.id} item={it} groups={groupsByItem[it.id] ?? []} layout={itemLayout} onOpen={onOpen} />
    ));
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Back header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 10 }}>
        <View style={[rowDir(lang), { alignItems: "center", gap: 10 }]}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t.menu.backToCategories}
            hitSlop={6}
            style={[rowDir(lang), { alignItems: "center", gap: 4, backgroundColor: theme.harissaTint, borderRadius: 100, paddingStart: 10, paddingEnd: 14, paddingVertical: 7 }]}
          >
            <T weight="extrabold" size={13.5} color={theme.harissaPressed}>
              {isRtl ? "›" : "‹"} {t.menu.backToCategories}
            </T>
          </Pressable>
          <T lang={lang} display size={19} numberOfLines={1} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
            {tr(node.name_i18n)}
          </T>
        </View>

        {/* Subcategory sub-pills */}
        {hasSubs && sections.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, flexDirection: "row" }}
            style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
          >
            <SubPill active={activeSub === null} onPress={() => setActiveSub(null)} isRtl={isRtl} lang={lang}>
              {t.menu.category}
            </SubPill>
            {sections
              .filter((s) => s.name)
              .map((s) => (
                <SubPill key={s.id} active={activeSub === s.id} onPress={() => setActiveSub(s.id)} isRtl={isRtl} lang={lang}>
                  {s.name!}
                </SubPill>
              ))}
          </ScrollView>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        {visibleSections.map((section) => (
          <View key={section.id} style={{ gap: 10 }}>
            {section.name && activeSub === null && (
              <T lang={lang} weight="extrabold" size={14} color={theme.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
                {section.name}
              </T>
            )}
            {renderItems(section.list)}
          </View>
        ))}
        {visibleSections.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <T lang={lang} display size={20}>
              {t.menu.noResults}
            </T>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SubPill({
  active,
  onPress,
  children,
  isRtl,
  lang,
}: {
  active: boolean;
  onPress: () => void;
  children: string;
  isRtl: boolean;
  lang: Language;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[
        isRtl ? { transform: [{ scaleX: -1 }] } : undefined,
        {
          height: 34,
          paddingHorizontal: 14,
          borderRadius: 100,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? theme.ink : theme.card,
          borderWidth: active ? 0 : 1.5,
          borderColor: theme.border,
        },
      ]}
    >
      <T lang={lang} weight={active ? "extrabold" : "bold"} size={13} color={active ? theme.cream : theme.muted}>
        {children}
      </T>
    </Pressable>
  );
}
