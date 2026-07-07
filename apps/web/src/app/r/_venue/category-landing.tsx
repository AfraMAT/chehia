"use client";

import {
  interpolate,
  nodeItemCount,
  type CategoryLayout,
  type CategoryNode,
} from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPlaceholder } from "@/components/ui";

/** The category-first landing — renders the business's chosen layout. */
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
  const { t, tr } = useI18n();
  const count = (node: CategoryNode) => nodeItemCount(node, itemCountByCategory);
  const countLabel = (n: number) => interpolate(t.menu.itemsCount, { n });

  const heading = (
    <h2 className="px-5 pt-3 pb-1 font-display font-extrabold text-[19px] text-ink">{t.menu.browseByCategory}</h2>
  );

  // Emoji icon or the photo weave, used across layouts.
  const media = (node: CategoryNode, className: string) =>
    node.icon && !node.image_url ? (
      <div className={`flex items-center justify-center bg-harissa-tint text-[26px] ${className}`} aria-hidden>
        {node.icon}
      </div>
    ) : (
      <PhotoPlaceholder src={node.image_url} alt="" className={className} />
    );

  if (layout === "list") {
    return (
      <div className="flex flex-col">
        {heading}
        <div className="px-5 pb-4 flex flex-col gap-2.5">
          {tree.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className="text-start bg-card border border-line rounded-xl p-2.5 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              {media(node, "w-16 h-16 rounded-lg shrink-0")}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-extrabold text-[16px] text-ink truncate">{tr(node.name_i18n)}</span>
                <span className="text-[12.5px] text-muted-soft">{countLabel(count(node))}</span>
              </div>
              <span className="text-muted-soft font-extrabold rtl:rotate-180 pe-1">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "circles") {
    return (
      <div className="flex flex-col">
        {heading}
        <div className="px-5 pb-4 grid grid-cols-3 gap-x-3 gap-y-4">
          {tree.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              {media(node, "w-[84px] h-[84px] rounded-full shrink-0 border-[1.5px] border-line")}
              <span className="font-bold text-[12.5px] text-ink text-center leading-tight line-clamp-2">
                {tr(node.name_i18n)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "banner") {
    return (
      <div className="flex flex-col">
        {heading}
        <div className="px-5 pb-4 flex flex-col gap-3">
          {tree.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className="relative h-[128px] rounded-2xl overflow-hidden text-start cursor-pointer hover:shadow-md transition-shadow"
            >
              {media(node, "absolute inset-0 w-full h-full")}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col gap-0.5">
                <span className="font-display font-extrabold text-[21px] text-cream leading-tight">{tr(node.name_i18n)}</span>
                <span className="text-[12.5px] font-semibold text-cream/85">{countLabel(count(node))}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "carousel") {
    return (
      <div className="flex flex-col">
        {heading}
        <div className="flex gap-3 px-5 pb-4 overflow-x-auto no-scrollbar snap-x">
          {tree.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className="snap-start shrink-0 w-[150px] text-start bg-card border border-line rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              {media(node, "w-full h-[110px]")}
              <div className="p-2.5 flex flex-col gap-0.5">
                <span className="font-extrabold text-[14px] text-ink truncate">{tr(node.name_i18n)}</span>
                <span className="text-[11.5px] text-muted-soft">{countLabel(count(node))}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Default: grid (2 columns).
  return (
    <div className="flex flex-col">
      {heading}
      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
        {tree.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelect(node)}
            className="text-start bg-card border border-line rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
          >
            {media(node, "w-full aspect-[5/4]")}
            <div className="p-3 flex flex-col gap-0.5">
              <span className="font-extrabold text-[15px] text-ink leading-tight line-clamp-1">{tr(node.name_i18n)}</span>
              <span className="text-[12px] text-muted-soft">{countLabel(count(node))}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
