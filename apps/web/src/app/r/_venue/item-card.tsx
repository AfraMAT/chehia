"use client";

import {
  currencyLabel,
  formatRating,
  millimesToDisplay,
  type I18nText,
  type ImageStyle,
  type ItemLayout,
  type MenuItem,
  type ModifierGroup,
} from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { Stars, Tag } from "@/components/ui";
import { MenuImage } from "@/components/menu-art";

type DietaryTone = "green" | "amber" | "neutral";

/** Item card shared by the classic list, the category-items view, and search. */
export function ItemCard({
  item,
  groups,
  layout,
  imageStyle,
  categoryName,
  onOpen,
}: {
  item: MenuItem;
  groups: ModifierGroup[];
  layout: ItemLayout;
  imageStyle: ImageStyle;
  /** Parent category name, to pick default art when the item name is inconclusive. */
  categoryName?: I18nText;
  onOpen: (item: MenuItem) => void;
}) {
  const { t, tr, lang } = useI18n();
  const available = item.is_available;
  const sizes = groups.find((g) => g.min_select >= 1);

  const dietaryLabel = (tag: string): { label: string; tone: DietaryTone } | null => {
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

  const price = (
    <span
      className={`font-extrabold whitespace-nowrap ${available ? "text-ink" : "text-muted-soft font-bold text-[13px]"}`}
      dir="ltr"
    >
      {millimesToDisplay(item.price_millimes, lang)} <span className="text-[11px] text-muted-soft">{currencyLabel(lang)}</span>
    </span>
  );

  const tags = (
    <div className="flex gap-1.5 mt-0.5 flex-wrap items-center">
      {(item.rating_count ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1">
          <Stars value={item.rating_avg} size={12} />
          <span className="text-[12px] font-bold text-ink tabular-nums">{formatRating(item.rating_avg, lang)}</span>
        </span>
      )}
      {item.dietary_tags.slice(0, 2).map((tag) => {
        const d = dietaryLabel(tag);
        return d ? (
          <Tag key={tag} tone={d.tone}>
            {d.label}
          </Tag>
        ) : null;
      })}
      {sizes && <Tag tone="neutral">{sizes.modifiers.length} {t.menu.sizes}</Tag>}
    </div>
  );

  const plusButton = available && (
    <span
      aria-hidden
      className={`rounded-lg flex items-center justify-center font-extrabold shrink-0 ${
        item.is_popular ? "bg-harissa text-white shadow-[0_3px_8px_rgba(188,75,38,0.3)]" : "bg-harissa-tint text-harissa-pressed"
      } ${layout === "compact" ? "w-9 h-9 text-[18px]" : "w-[42px] h-[42px] text-[21px]"}`}
    >
      +
    </span>
  );

  // ---- Vertical card layout ----
  if (layout === "cards") {
    return (
      <button
        type="button"
        disabled={!available}
        onClick={() => onOpen(item)}
        className={`text-start bg-card border rounded-xl overflow-hidden flex flex-col transition-shadow ${
          !available
            ? "bg-sand opacity-70 cursor-default border-line"
            : item.is_popular
              ? "border-[1.5px] border-harissa shadow-[0_2px_8px_rgba(188,75,38,0.1)] cursor-pointer hover:shadow-md"
              : "border-line cursor-pointer hover:shadow-md"
        }`}
      >
        <div className="relative">
          <MenuImage src={item.photo_url} name={item.name_i18n} art={item.art} fallbackName={categoryName} imageStyle={imageStyle} className="w-full aspect-[4/3]" />
          {item.is_popular && available && (
            <span className="absolute top-2 start-2 bg-harissa text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
              {t.menu.popular}
            </span>
          )}
          {!available && (
            <span className="absolute top-2 start-2 text-[11px] font-extrabold text-muted-soft bg-cream/90 rounded-full px-2 py-0.5">
              {t.menu.soldOut}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1 p-3">
          <span className={`font-extrabold text-[15px] leading-tight ${available ? "text-ink" : "text-muted line-through"}`}>
            {tr(item.name_i18n)}
          </span>
          {available && <span className="text-[12px] text-muted leading-snug line-clamp-2">{tr(item.description_i18n)}</span>}
          <div className="flex items-center justify-between gap-2 mt-auto pt-1">
            {price}
            {plusButton}
          </div>
          {available && tags}
        </div>
      </button>
    );
  }

  // ---- Horizontal list / compact layouts ----
  const compact = layout === "compact";
  return (
    <button
      type="button"
      disabled={!available}
      onClick={() => onOpen(item)}
      className={`text-start bg-card border rounded-xl p-3 flex gap-3 items-center transition-shadow ${
        !available
          ? "bg-sand opacity-70 cursor-default border-line"
          : item.is_popular
            ? "border-[1.5px] border-harissa shadow-[0_2px_8px_rgba(188,75,38,0.1)] cursor-pointer hover:shadow-md"
            : "border-line cursor-pointer hover:shadow-md"
      }`}
    >
      <div className="relative shrink-0">
        <MenuImage src={item.photo_url} name={item.name_i18n} art={item.art} fallbackName={categoryName} imageStyle={imageStyle} className={`${compact ? "w-14 h-14" : "w-[68px] h-[68px]"} rounded-lg`} />
        {item.is_popular && available && (
          <span className="absolute -top-2 -start-2 bg-harissa text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
            {t.menu.popular}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex justify-between gap-2">
          <span className={`font-extrabold text-[15.5px] ${available ? "text-ink" : "text-muted line-through"}`}>
            {tr(item.name_i18n)}
          </span>
          <span className="text-[15.5px]">{price}</span>
        </div>
        {available ? (
          <>
            {!compact && (
              <span className="text-[12.5px] text-muted leading-snug line-clamp-2">{tr(item.description_i18n)}</span>
            )}
            {tags}
          </>
        ) : (
          <span className="self-start text-[11px] font-extrabold text-muted-soft bg-sand-deep rounded-full px-2 py-0.5">
            {t.menu.soldOut}
          </span>
        )}
      </div>
      {plusButton}
    </button>
  );
}
