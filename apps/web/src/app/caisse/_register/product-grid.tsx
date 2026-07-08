"use client";

import { useMemo, useState } from "react";
import type { MenuItem } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse } from "../caisse-provider";
import { money, txt } from "./util";

/**
 * The product grid — the cashier's main surface. A category rail + a dense grid
 * of quick-key tiles. Tapping a tile hands the item up to the register, which
 * either adds it straight to the ticket or opens the modifier sheet.
 */
export function ProductGrid({ onPick }: { onPick: (item: MenuItem) => void }) {
  const { t } = useI18n();
  const { categories, items } = useCaisse();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (activeCat && it.category_id !== activeCat) return false;
      if (q && !txt(it.name_i18n).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, activeCat, query]);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-sand">
      {/* Search */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.caisse.common.searchPlaceholder}
          className="w-full h-11 rounded-xl border-[1.5px] border-line-strong bg-white px-4 text-[15px] text-ink placeholder:text-muted-soft outline-none focus:border-harissa transition-colors"
        />
      </div>

      {/* Category rail */}
      <div className="px-4 pb-2 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
        <CatChip label={t.caisse.common.all} active={activeCat === null} onClick={() => setActiveCat(null)} />
        {categories.map((c) => (
          <CatChip key={c.id} label={txt(c.name_i18n)} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
        ))}
      </div>

      {/* Tiles */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1">
        {visible.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[14px] text-muted-soft font-semibold">
            {t.caisse.common.noItems}
          </div>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))" }}>
            {visible.map((it) => (
              <Tile key={it.id} item={it} onPick={onPick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-9 px-4 rounded-full text-[13.5px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
        active ? "bg-ink text-cream" : "bg-white text-muted border border-line hover:border-line-strong"
      }`}
    >
      {label}
    </button>
  );
}

function Tile({ item, onPick }: { item: MenuItem; onPick: (item: MenuItem) => void }) {
  const { t } = useI18n();
  const available = item.is_available;
  return (
    <button
      type="button"
      disabled={!available}
      onClick={() => onPick(item)}
      className={`relative h-[92px] rounded-xl border p-2.5 flex flex-col justify-between text-start transition-all ${
        available
          ? "bg-white border-line hover:border-harissa hover:shadow-[0_4px_14px_rgba(188,75,38,0.14)] active:scale-[0.98] cursor-pointer"
          : "bg-sand border-line opacity-55 cursor-not-allowed"
      }`}
    >
      {item.is_popular && available && (
        <span className="absolute top-2 end-2 w-2 h-2 rounded-full bg-harissa" aria-hidden />
      )}
      <span className="font-bold text-[13.5px] leading-tight text-ink line-clamp-2 pe-2">{txt(item.name_i18n)}</span>
      <span className="font-extrabold text-[13px] text-harissa-pressed tabular-nums" dir="ltr">
        {available ? money(item.price_millimes) : t.caisse.common.soldOut}
      </span>
    </button>
  );
}
