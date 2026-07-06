"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cartCount, cartTotal, formatPrice, formatRating, millimesToDisplay, currencyLabel, type MenuItem } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { ZelligeMark } from "@/components/brand";
import { PhotoPlaceholder, SearchIcon, Skeleton, Stars, Tag } from "@/components/ui";
import { useVenue } from "./venue-provider";
import { ItemSheet } from "./item-sheet";
import { WaiterSheet } from "./waiter-sheet";
import { OfflineBanner } from "./offline-banner";
import { ActiveOrderBanner } from "./active-order-banner";

/** P2 · Menu — category pills, dietary tags, 86'd items stay visible, persistent cart bar. */
export function MenuScreen() {
  const venue = useVenue();
  const { restaurant, table, categories, items, cart, groupsByItem, basePath } = venue;
  const { t, tr, lang } = useI18n();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [waiterOpen, setWaiterOpen] = useState(false);

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
  // Menu still populating (no items on the menu yet, no active search): show a
  // skeleton grid rather than flashing an empty "no results" state.
  const menuLoading = items.length === 0 && !search.trim();

  const dietaryLabel = (tag: string): { label: string; tone: "green" | "amber" | "neutral" } | null => {
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
    <div className="flex flex-col min-h-dvh pb-24">
      <OfflineBanner />

      {/* Header */}
      <header className="px-5 pt-4 flex items-center gap-2.5">
        <ZelligeMark size={30} />
        <div className="flex-1 flex flex-col min-w-0">
          <span className="font-extrabold text-base text-ink leading-tight truncate">{restaurant.name}</span>
          <span className="text-[11.5px] font-semibold text-muted-soft">
            {t.menu.title} · {lang === "fr" ? "Français" : lang === "ar" ? "العربية" : "English"}
          </span>
        </div>
        <Link
          href={basePath}
          className="flex items-center gap-1.5 bg-harissa-tint rounded-full px-3 py-1.5"
        >
          <span className="font-extrabold text-[13px] text-harissa-pressed">
            {table ? `${t.common.table} ${table.label}` : t.landing.chooseTable}
          </span>
        </Link>
        {/* Waiter is reachable from the menu too, not only after ordering — a
            dine-in guest may want water or the bill before they order. */}
        {table && (
          <button
            type="button"
            onClick={() => setWaiterOpen(true)}
            aria-label={t.waiter.call}
            className="shrink-0 w-10 h-10 rounded-full bg-white border-[1.5px] border-line flex items-center justify-center hover:border-harissa transition-colors cursor-pointer"
          >
            <span aria-hidden className="text-[17px]">🔔</span>
          </button>
        )}
      </header>

      {/* Return to an order placed from this device */}
      <ActiveOrderBanner className="mx-5 mt-3" />

      {/* Sticky nav: search + category pills stay reachable while scrolling a long menu */}
      <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm pb-1">
      {/* Search */}
      <div className="px-5 pt-3.5">
        <div className="h-[46px] rounded-lg bg-white border-[1.5px] border-line flex items-center gap-2.5 px-3.5 focus-within:border-harissa transition-colors">
          <SearchIcon className="text-muted-soft shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.menu.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted-soft outline-none min-w-0"
          />
        </div>
      </div>

      {/* Category pills */}
      {!search && (
        <div className="flex gap-2 px-5 pt-3 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 h-[38px] px-4 rounded-full font-bold text-[13.5px] transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-ink text-cream font-extrabold"
                  : "bg-white border-[1.5px] border-line text-muted"
              }`}
            >
              {tr(cat.name_i18n)}
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Items */}
      <main className="flex-1 px-5 pt-2.5 flex flex-col gap-2.5">
        {menuLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-line rounded-xl p-3 flex gap-3 items-center">
              <Skeleton className="w-[68px] h-[68px] rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        {!menuLoading && visibleItems.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="font-display font-extrabold text-xl text-ink">{t.menu.noResults}</span>
            <span className="text-sm text-muted">{t.menu.noResultsBody}</span>
          </div>
        )}
        {visibleItems.map((item) => {
          const available = item.is_available;
          const sizes = (groupsByItem[item.id] ?? []).find((g) => g.min_select >= 1);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!available}
              onClick={() => setOpenItem(item)}
              className={`text-start bg-white border rounded-xl p-3 flex gap-3 items-center transition-shadow ${
                !available
                  ? "bg-sand opacity-70 cursor-default"
                  : item.is_popular
                    ? "border-[1.5px] border-harissa shadow-[0_2px_8px_rgba(188,75,38,0.1)] cursor-pointer hover:shadow-md"
                    : "border-line cursor-pointer hover:shadow-md"
              }`}
            >
              <div className="relative shrink-0">
                <PhotoPlaceholder src={item.photo_url} alt="" className="w-[68px] h-[68px] rounded-lg" />
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
                  <span className={`font-extrabold text-[15.5px] whitespace-nowrap ${available ? "text-ink" : "text-muted-soft font-bold text-[13px]"}`} dir="ltr">
                    {millimesToDisplay(item.price_millimes, lang)}{" "}
                    <span className="text-[11px] text-muted-soft">{currencyLabel(lang)}</span>
                  </span>
                </div>
                {available ? (
                  <>
                    <span className="text-[12.5px] text-muted leading-snug line-clamp-2">
                      {tr(item.description_i18n)}
                    </span>
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
                  </>
                ) : (
                  <span className="self-start text-[11px] font-extrabold text-muted-soft bg-sand-deep rounded-full px-2 py-0.5">
                    {t.menu.soldOut}
                  </span>
                )}
              </div>
              {available && (
                <span
                  aria-hidden
                  className={`w-[42px] h-[42px] rounded-lg flex items-center justify-center font-extrabold text-[21px] shrink-0 ${
                    item.is_popular
                      ? "bg-harissa text-white shadow-[0_3px_8px_rgba(188,75,38,0.3)]"
                      : "bg-harissa-tint text-harissa-pressed"
                  }`}
                >
                  +
                </span>
              )}
            </button>
          );
        })}
      </main>

      {/* Persistent cart bar */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => router.push(`${basePath}/cart`)}
          className="fixed bottom-3.5 inset-x-4 max-w-[488px] mx-auto h-[58px] rounded-2xl bg-ink flex items-center ps-4 pe-2 gap-3 shadow-[0_10px_26px_rgba(34,26,19,0.35)] cursor-pointer z-40"
        >
          <span className="w-6 h-6 rounded-md bg-harissa text-white font-extrabold text-[13px] flex items-center justify-center">
            {count}
          </span>
          <span className="flex-1 text-start text-cream font-extrabold text-[15px]">{t.menu.viewCart}</span>
          <span className="text-cream font-extrabold text-[15px] bg-white/10 rounded-lg px-3.5 py-2" dir="ltr">
            {formatPrice(cartTotal(cart), lang)}
          </span>
        </button>
      )}

      {/* P3 · Item detail sheet */}
      {openItem && <ItemSheet item={openItem} onClose={() => setOpenItem(null)} />}
      {waiterOpen && <WaiterSheet onClose={() => setWaiterOpen(false)} />}
    </div>
  );
}
