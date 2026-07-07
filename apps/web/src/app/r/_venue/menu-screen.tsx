"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildCategoryTree,
  cartCount,
  cartTotal,
  descendantCategoryIds,
  formatPrice,
  resolveAppearance,
  type CategoryNode,
  type MenuItem,
} from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { ZelligeMark } from "@/components/brand";
import { SearchIcon, Skeleton } from "@/components/ui";
import { useVenue } from "./venue-provider";
import { ItemSheet } from "./item-sheet";
import { ItemCard } from "./item-card";
import { CategoryLanding } from "./category-landing";
import { CategoryItems } from "./category-items";
import { WaiterSheet } from "./waiter-sheet";
import { OfflineBanner } from "./offline-banner";
import { ActiveOrderBanner } from "./active-order-banner";
import { GroupEntry } from "./group/group-entry";

/**
 * P2 · Menu — category-first landing (business-selectable layout) that drills
 * into items, or the classic pills+list view. Search always flattens across the
 * whole menu. Theme comes from the venue layout's --color-* overrides.
 */
export function MenuScreen() {
  const venue = useVenue();
  const { restaurant, table, categories, items, cart, groupsByItem, basePath } = venue;
  const { t, tr, lang } = useI18n();
  const router = useRouter();

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
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(tree[0]?.id ?? "");

  const selectedRoot: CategoryNode | null = useMemo(
    () => (selectedRootId ? tree.find((n) => n.id === selectedRootId) ?? null : null),
    [selectedRootId, tree],
  );

  // Browser back returns from a category to the landing rather than leaving.
  useEffect(() => {
    if (!selectedRootId) return;
    const onPop = () => setSelectedRootId(null);
    window.history.pushState({ cat: selectedRootId }, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [selectedRootId]);

  const onMenuItems = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return items.filter((i) => ids.has(i.category_id));
  }, [items, categories]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return onMenuItems.filter((i) =>
      Object.values(i.name_i18n)
        .concat(Object.values(i.description_i18n))
        .some((s) => s?.toLowerCase().includes(q)),
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
  const menuLoading = items.length === 0 && !search.trim();
  const searching = search.trim().length > 0;
  const containerCls = appearance.itemLayout === "cards" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2.5";

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
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="flex items-center gap-1.5 bg-harissa-tint rounded-full px-3 py-1.5 cursor-pointer"
        >
          <span className="font-extrabold text-[13px] text-harissa-pressed">
            {table ? `${t.common.table} ${table.label}` : t.landing.chooseTable}
          </span>
        </button>
        {table && (
          <button
            type="button"
            onClick={() => setWaiterOpen(true)}
            aria-label={t.waiter.call}
            className="shrink-0 w-10 h-10 rounded-full bg-card border-[1.5px] border-line flex items-center justify-center hover:border-harissa transition-colors cursor-pointer"
          >
            <span aria-hidden className="text-[17px]">🔔</span>
          </button>
        )}
      </header>

      <ActiveOrderBanner className="mx-5 mt-3" />

      {/* Group ordering entry (scanned tables only; self-hides otherwise) */}
      <GroupEntry className="mt-3 mx-5" />

      {/* Sticky search (+ classic pills) */}
      <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm pb-1">
        <div className="px-5 pt-3.5">
          <div className="h-[46px] rounded-lg bg-card border-[1.5px] border-line flex items-center gap-2.5 px-3.5 focus-within:border-harissa transition-colors">
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

        {!searching && !useLanding && (
          <div className="flex gap-2 px-5 pt-3 overflow-x-auto no-scrollbar">
            {tree.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 h-[38px] px-4 rounded-full font-bold text-[13.5px] transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-ink text-cream font-extrabold"
                    : "bg-card border-[1.5px] border-line text-muted"
                }`}
              >
                {tr(cat.name_i18n)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {menuLoading ? (
        <main className="flex-1 px-5 pt-2.5 flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-line rounded-xl p-3 flex gap-3 items-center">
              <Skeleton className="w-[68px] h-[68px] rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </main>
      ) : searching ? (
        <main className="flex-1 px-5 pt-2.5">
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <span className="font-display font-extrabold text-xl text-ink">{t.menu.noResults}</span>
              <span className="text-sm text-muted">{t.menu.noResultsBody}</span>
            </div>
          ) : (
            <div className={containerCls}>
              {searchResults.map((item) => (
                <ItemCard key={item.id} item={item} groups={groupsByItem[item.id] ?? []} layout={appearance.itemLayout} onOpen={setOpenItem} />
              ))}
            </div>
          )}
        </main>
      ) : useLanding && selectedRoot ? (
        <CategoryItems
          node={selectedRoot}
          items={onMenuItems}
          groupsByItem={groupsByItem}
          itemLayout={appearance.itemLayout}
          onBack={() => setSelectedRootId(null)}
          onOpen={setOpenItem}
        />
      ) : useLanding ? (
        <CategoryLanding
          tree={tree}
          layout={appearance.categoryLayout}
          itemCountByCategory={itemCountByCategory}
          onSelect={(node) => setSelectedRootId(node.id)}
        />
      ) : (
        <main className="flex-1 px-5 pt-2.5">
          {classicItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <span className="font-display font-extrabold text-xl text-ink">{t.menu.noResults}</span>
              <span className="text-sm text-muted">{t.menu.noResultsBody}</span>
            </div>
          ) : (
            <div className={containerCls}>
              {classicItems.map((item) => (
                <ItemCard key={item.id} item={item} groups={groupsByItem[item.id] ?? []} layout={appearance.itemLayout} onOpen={setOpenItem} />
              ))}
            </div>
          )}
        </main>
      )}

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

      {openItem && <ItemSheet item={openItem} onClose={() => setOpenItem(null)} />}
      {waiterOpen && <WaiterSheet onClose={() => setWaiterOpen(false)} />}
    </div>
  );
}
