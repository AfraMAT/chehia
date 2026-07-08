import { Pressable, ScrollView, Text, View } from "react-native";
import {
  interpolate,
  nodeItemCount,
  type CategoryLayout,
  type CategoryNode,
} from "@chehia/shared";
import { PhotoPlaceholder, T } from "../ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir, useTheme } from "@/lib/theme";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * The category-first landing (Epic 1) — renders the venue's chosen layout
 * (grid · list · circles · banner · carousel). Mirrors the web
 * `category-landing`. An emoji icon (when set and no photo) stands in for the
 * media; otherwise the weave placeholder / photo.
 */
export function CategoryLanding({
  tree,
  layout,
  itemCountByCategory,
  onSelect,
}: {
  tree: CategoryNode[];
  layout: CategoryLayout;
  itemCountByCategory: Record<string, number>;
  onSelect: (node: CategoryNode) => void;
}) {
  const { t, tr, lang, isRtl } = useI18n();
  const theme = useTheme();
  const countLabel = (node: CategoryNode) => interpolate(t.menu.itemsCount, { n: nodeItemCount(node, itemCountByCategory) });

  // Emoji tile (icon set + no photo), else the photo / weave placeholder.
  const Media = ({
    node,
    width,
    height,
    radius,
  }: {
    node: CategoryNode;
    width: number | "100%";
    height: number;
    radius: number;
  }) =>
    node.icon && !node.image_url ? (
      <View
        accessibilityElementsHidden
        style={{ width, height, borderRadius: radius, backgroundColor: theme.harissaTint, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: Math.min(30, height * 0.34) }}>{node.icon}</Text>
      </View>
    ) : (
      <PhotoPlaceholder width={width} height={height} radius={radius} mirrored={isRtl} src={node.image_url} />
    );

  const Heading = () => (
    <T lang={lang} display size={19} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, textAlign: isRtl ? "right" : "left" }}>
      {t.menu.browseByCategory}
    </T>
  );

  const chevron = (
    <T weight="extrabold" size={18} color={theme.mutedSoft}>
      {isRtl ? "‹" : "›"}
    </T>
  );

  if (layout === "list") {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Heading />
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {tree.map((node) => (
            <Pressable
              key={node.id}
              onPress={() => onSelect(node)}
              accessibilityRole="button"
              accessibilityLabel={tr(node.name_i18n)}
              style={[rowDir(lang), { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 10, alignItems: "center", gap: 12 }]}
            >
              <Media node={node} width={64} height={64} radius={12} />
              <View style={{ flex: 1, gap: 2 }}>
                <T lang={lang} weight="extrabold" size={16} numberOfLines={1} style={{ textAlign: isRtl ? "right" : "left" }}>
                  {tr(node.name_i18n)}
                </T>
                <T lang={lang} weight="semibold" size={12.5} color={theme.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
                  {countLabel(node)}
                </T>
              </View>
              {chevron}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  if (layout === "circles") {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Heading />
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          {chunk(tree, 3).map((row, ri) => (
            <View key={ri} style={[rowDir(lang), { gap: 12 }]}>
              {row.map((node) => (
                <Pressable
                  key={node.id}
                  onPress={() => onSelect(node)}
                  accessibilityRole="button"
                  accessibilityLabel={tr(node.name_i18n)}
                  style={{ flex: 1, alignItems: "center", gap: 8 }}
                >
                  <Media node={node} width={84} height={84} radius={42} />
                  <T lang={lang} weight="bold" size={12.5} numberOfLines={2} style={{ textAlign: "center" }}>
                    {tr(node.name_i18n)}
                  </T>
                </Pressable>
              ))}
              {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => <View key={`s${i}`} style={{ flex: 1 }} />)}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  if (layout === "banner") {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Heading />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {tree.map((node) => (
            <Pressable
              key={node.id}
              onPress={() => onSelect(node)}
              accessibilityRole="button"
              accessibilityLabel={tr(node.name_i18n)}
              style={{ height: 128, borderRadius: 18, overflow: "hidden" }}
            >
              <Media node={node} width="100%" height={128} radius={0} />
              {/* Fixed dark scrim so the light label reads on any photo/theme. */}
              <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(34,26,19,0.42)" }} />
              <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 2 }}>
                <T lang={lang} display size={21} color={colors.cream} style={{ textAlign: isRtl ? "right" : "left" }}>
                  {tr(node.name_i18n)}
                </T>
                <T lang={lang} weight="semibold" size={12.5} color="rgba(250,246,239,0.85)" style={{ textAlign: isRtl ? "right" : "left" }}>
                  {countLabel(node)}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  if (layout === "carousel") {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Heading />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20, flexDirection: "row" }}
          style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
        >
          {tree.map((node) => (
            <Pressable
              key={node.id}
              onPress={() => onSelect(node)}
              accessibilityRole="button"
              accessibilityLabel={tr(node.name_i18n)}
              style={[
                isRtl ? { transform: [{ scaleX: -1 }] } : undefined,
                { width: 150, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 18, overflow: "hidden" },
              ]}
            >
              <Media node={node} width="100%" height={110} radius={0} />
              <View style={{ padding: 10, gap: 2 }}>
                <T lang={lang} weight="extrabold" size={14} numberOfLines={1} style={{ textAlign: isRtl ? "right" : "left" }}>
                  {tr(node.name_i18n)}
                </T>
                <T lang={lang} weight="semibold" size={11.5} color={theme.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
                  {countLabel(node)}
                </T>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    );
  }

  // Default: grid (2 columns).
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <Heading />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {chunk(tree, 2).map((row, ri) => (
          <View key={ri} style={[rowDir(lang), { gap: 12 }]}>
            {row.map((node) => (
              <Pressable
                key={node.id}
                onPress={() => onSelect(node)}
                accessibilityRole="button"
                accessibilityLabel={tr(node.name_i18n)}
                style={{ flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 18, overflow: "hidden" }}
              >
                <Media node={node} width="100%" height={112} radius={0} />
                <View style={{ padding: 12, gap: 2 }}>
                  <T lang={lang} weight="extrabold" size={15} numberOfLines={1} style={{ textAlign: isRtl ? "right" : "left" }}>
                    {tr(node.name_i18n)}
                  </T>
                  <T lang={lang} weight="semibold" size={12} color={theme.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
                    {countLabel(node)}
                  </T>
                </View>
              </Pressable>
            ))}
            {row.length < 2 && <View style={{ flex: 1 }} />}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
