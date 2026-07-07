"use client";

import { useMemo, useState } from "react";
import type { CategoryNode, ItemLayout, MenuItem, ModifierGroup } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { ItemCard } from "./item-card";

/** Items of a selected top-level category, grouped by its subcategories. */
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
  const { t, tr } = useI18n();
  const [activeSub, setActiveSub] = useState<string | null>(null);

  const itemsByCategory = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const it of items) (map[it.category_id] ??= []).push(it);
    return map;
  }, [items]);

  const ownItems = itemsByCategory[node.id] ?? [];
  const hasSubs = node.children.length > 0;
  const containerCls = itemLayout === "cards" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2.5";

  const renderItems = (list: MenuItem[]) => (
    <div className={containerCls}>
      {list.map((item) => (
        <ItemCard key={item.id} item={item} groups={groupsByItem[item.id] ?? []} layout={itemLayout} onOpen={onOpen} />
      ))}
    </div>
  );

  // Sections: the category's own items, then one per subcategory.
  const sections = [
    ...(ownItems.length ? [{ id: node.id, name: null as string | null, list: ownItems }] : []),
    ...node.children.map((sub) => ({ id: sub.id, name: tr(sub.name_i18n), list: itemsByCategory[sub.id] ?? [] })),
  ].filter((s) => s.list.length > 0);

  const visibleSections = activeSub ? sections.filter((s) => s.id === activeSub) : sections;

  return (
    <div className="flex flex-col">
      {/* Back header */}
      <div className="bg-cream">
        <div className="px-5 pt-3 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[13.5px] font-extrabold text-harissa-pressed bg-harissa-tint rounded-full ps-2.5 pe-3.5 py-1.5 cursor-pointer shrink-0"
          >
            <span aria-hidden className="rtl:rotate-180">‹</span> {t.menu.backToCategories}
          </button>
          <h2 className="font-display font-extrabold text-[19px] text-ink truncate">{tr(node.name_i18n)}</h2>
        </div>

        {/* Subcategory sub-pills */}
        {hasSubs && sections.length > 1 && (
          <div className="flex gap-2 px-5 pb-2 overflow-x-auto no-scrollbar">
            <SubPill active={activeSub === null} onClick={() => setActiveSub(null)}>
              {t.menu.category}
            </SubPill>
            {sections
              .filter((s) => s.name)
              .map((s) => (
                <SubPill key={s.id} active={activeSub === s.id} onClick={() => setActiveSub(s.id)}>
                  {s.name}
                </SubPill>
              ))}
          </div>
        )}
      </div>

      <main className="px-5 pt-2 pb-2 flex flex-col gap-4">
        {visibleSections.map((section) => (
          <div key={section.id} className="flex flex-col gap-2.5">
            {section.name && activeSub === null && (
              <h3 className="font-extrabold text-[14px] text-muted-soft tracking-wide">{section.name}</h3>
            )}
            {renderItems(section.list)}
          </div>
        ))}
        {visibleSections.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="font-display font-extrabold text-xl text-ink">{t.menu.noResults}</span>
          </div>
        )}
      </main>
    </div>
  );
}

function SubPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-[34px] px-3.5 rounded-full font-bold text-[13px] transition-colors cursor-pointer ${
        active ? "bg-ink text-cream font-extrabold" : "bg-card border-[1.5px] border-line text-muted"
      }`}
    >
      {children}
    </button>
  );
}
