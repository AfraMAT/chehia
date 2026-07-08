import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import {
  currencyLabel,
  formatRating,
  millimesToDisplay,
  type Dictionary,
  type ItemLayout,
  type MenuItem,
  type ModifierGroup,
} from "@chehia/shared";
import { PhotoPlaceholder, Stars, T, TagPill } from "../ui";
import { useI18n } from "@/lib/i18n";
import { rowDir, useTheme } from "@/lib/theme";

function dietaryTag(tag: string, t: Dictionary): { label: string; tone: "green" | "amber" | "neutral" } | null {
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
}

/**
 * A single menu item, in one of the venue-selectable item layouts (Epic 1):
 * `list` (the classic full-width row — unchanged default), `compact` (a slim
 * row, no description), or `cards` (a two-column vertical card; the parent grid
 * gives it its flex slot). Shared by the classic list, search, and the
 * category-items view so the look is identical everywhere.
 */
export function ItemCard({
  item,
  groups,
  layout,
  onOpen,
  style,
}: {
  item: MenuItem;
  groups: ModifierGroup[];
  layout: ItemLayout;
  onOpen: (item: MenuItem) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t, tr, lang, isRtl } = useI18n();
  const theme = useTheme();
  const available = item.is_available;
  const sizeGroup = groups.find((g) => g.min_select >= 1);
  const priceLabel = millimesToDisplay(item.price_millimes, lang);

  const a11yLabel =
    `${tr(item.name_i18n)}, ${priceLabel} ${currencyLabel(lang)}` +
    (item.is_popular && available ? `, ${t.menu.popular}` : "") +
    (available ? "" : `, ${t.menu.soldOut}`);

  // ---- Cards layout: a two-column vertical card. ----
  if (layout === "cards") {
    return (
      <Pressable
        disabled={!available}
        onPress={() => onOpen(item)}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: !available }}
        accessibilityLabel={a11yLabel}
        accessibilityHint={available ? t.item.addToCart : undefined}
        style={[
          {
            backgroundColor: available ? theme.card : theme.sand,
            borderWidth: item.is_popular && available ? 1.5 : 1,
            borderColor: item.is_popular && available ? theme.harissa : theme.border,
            borderRadius: 16,
            overflow: "hidden",
            opacity: available ? 1 : 0.66,
          },
          style,
        ]}
      >
        <View>
          <PhotoPlaceholder width="100%" height={104} radius={0} mirrored={isRtl} src={item.photo_url} />
          {item.is_popular && available && (
            <View
              style={{
                position: "absolute",
                top: 8,
                [isRtl ? "right" : "left"]: 8,
                backgroundColor: theme.harissa,
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
        <View style={{ padding: 11, gap: 3 }}>
          <T
            lang={lang}
            weight="extrabold"
            size={14}
            numberOfLines={1}
            color={available ? theme.ink : theme.muted}
            style={{ textAlign: isRtl ? "right" : "left", textDecorationLine: available ? "none" : "line-through" }}
          >
            {tr(item.name_i18n)}
          </T>
          <View style={[rowDir(lang), { alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
            <T weight={available ? "extrabold" : "bold"} size={13.5} color={available ? theme.ink : theme.mutedSoft}>
              {priceLabel}{" "}
              <T size={10.5} color={theme.mutedSoft} lang={lang}>
                {currencyLabel(lang)}
              </T>
            </T>
            {available ? (
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: theme.harissaTint, alignItems: "center", justifyContent: "center" }}>
                <T weight="extrabold" size={17} color={theme.harissaPressed}>
                  +
                </T>
              </View>
            ) : (
              <TagPill lang={lang} label={t.menu.soldOut} tone="soldout" />
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // ---- List (default) + compact: a full-width row. ----
  const compact = layout === "compact";
  const photo = compact ? 52 : 68;
  return (
    <Pressable
      disabled={!available}
      onPress={() => onOpen(item)}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: !available }}
      accessibilityLabel={a11yLabel}
      accessibilityHint={available ? t.item.addToCart : undefined}
      style={[
        rowDir(lang),
        {
          backgroundColor: available ? theme.card : theme.sand,
          borderWidth: item.is_popular && available ? 1.5 : 1,
          borderColor: item.is_popular && available ? theme.harissa : theme.border,
          borderRadius: 16,
          padding: 12,
          gap: 12,
          alignItems: "center",
          opacity: available ? 1 : 0.66,
        },
        style,
      ]}
    >
      <View>
        <PhotoPlaceholder width={photo} height={photo} mirrored={isRtl} src={item.photo_url} />
        {item.is_popular && available && (
          <View
            style={{
              position: "absolute",
              top: -7,
              [isRtl ? "right" : "left"]: -7,
              backgroundColor: theme.harissa,
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
            color={available ? theme.ink : theme.muted}
            style={{ textDecorationLine: available ? "none" : "line-through", flexShrink: 1 }}
          >
            {tr(item.name_i18n)}
          </T>
          <T weight={available ? "extrabold" : "bold"} size={available ? 15.5 : 13} color={available ? theme.ink : theme.mutedSoft}>
            {priceLabel}{" "}
            <T size={11} color={theme.mutedSoft} lang={lang}>
              {currencyLabel(lang)}
            </T>
          </T>
        </View>
        {available ? (
          <>
            {!compact && (
              <T lang={lang} size={12.5} color={theme.muted} numberOfLines={2} style={{ textAlign: isRtl ? "right" : "left" }}>
                {tr(item.description_i18n)}
              </T>
            )}
            <View style={[rowDir(lang), { gap: 5, marginTop: 2, flexWrap: "wrap", alignItems: "center" }]}>
              {(item.rating_count ?? 0) > 0 && (
                <View style={[rowDir(lang), { alignItems: "center", gap: 4 }]}>
                  <Stars value={item.rating_avg} size={12} />
                  <T lang={lang} weight="bold" size={12} color={theme.ink}>
                    {formatRating(item.rating_avg, lang)}
                  </T>
                </View>
              )}
              {item.dietary_tags.slice(0, 2).map((tag) => {
                const d = dietaryTag(tag, t);
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
            backgroundColor: item.is_popular ? theme.harissa : theme.harissaTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T weight="extrabold" size={21} color={item.is_popular ? "#FFFFFF" : theme.harissaPressed}>
            +
          </T>
        </View>
      )}
    </Pressable>
  );
}
