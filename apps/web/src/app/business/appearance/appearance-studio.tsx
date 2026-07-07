"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  BUILTIN_THEMES,
  CATEGORY_LAYOUTS,
  IMAGE_STYLES,
  ITEM_LAYOUTS,
  availableThemes,
  buildCategoryTree,
  expandPalette,
  paletteToCssVars,
  resolveAppearance,
  resolveThemePalette,
  type Category,
  type CategoryLayout,
  type ImageStyle,
  type ItemLayout,
  type MenuAppearance,
  type Restaurant,
  type SeedColors,
  type ThemePalette,
  type ThemePreset,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPlaceholder, Toggle } from "@/components/ui";
import { MenuArt } from "@/components/menu-art";
import { CategoryLanding } from "@/app/r/_venue/category-landing";

const SAMPLE_CATEGORIES: Category[] = [
  { id: "s1", restaurant_id: "", name_i18n: { fr: "Cafés", ar: "قهوة", en: "Coffee" }, sort_order: 0, is_active: true, parent_id: null, image_url: null, icon: null, art: null },
  { id: "s2", restaurant_id: "", name_i18n: { fr: "Petit-déjeuner", ar: "فطور", en: "Breakfast" }, sort_order: 1, is_active: true, parent_id: null, image_url: null, icon: null, art: null },
  { id: "s3", restaurant_id: "", name_i18n: { fr: "Jus & citronnades", ar: "عصير", en: "Juices" }, sort_order: 2, is_active: true, parent_id: null, image_url: null, icon: null, art: null },
  { id: "s4", restaurant_id: "", name_i18n: { fr: "Pâtisseries", ar: "حلويات", en: "Pastries" }, sort_order: 3, is_active: true, parent_id: null, image_url: null, icon: null, art: null },
];

/** Reusable theme + layout editor. Used by the owner portal and the admin per-venue page. */
export function AppearanceStudio({
  restaurant,
  categories,
  onSaved,
}: {
  restaurant: Restaurant;
  categories?: Category[];
  onSaved?: (appearance: MenuAppearance) => void;
}) {
  const { t, tr } = useI18n();
  const tx = t.portal.appearance;

  const [draft, setDraft] = useState<MenuAppearance>(() => resolveAppearance(restaurant.appearance));
  const initialPalette = useMemo(() => resolveThemePalette(draft), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [seed, setSeed] = useState<SeedColors>({
    primary: initialPalette.primary,
    background: initialPalette.bg,
    surface: initialPalette.card,
    text: initialPalette.ink,
    accent: initialPalette.accent,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const palette = useMemo(() => resolveThemePalette(draft), [draft]);
  const previewTree = useMemo(
    () => buildCategoryTree((categories && categories.length ? categories : SAMPLE_CATEGORIES).filter((c) => c.is_active)),
    [categories],
  );
  const previewCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of previewTree) map[c.id] = 6;
    return map;
  }, [previewTree]);

  const themes = availableThemes(draft);
  const builtins = themes.filter((th) => BUILTIN_THEMES.some((b) => b.id === th.id));
  const extracted = (draft.extractedPalettes ?? []) as ThemePreset[];

  const pickTheme = (id: string) => setDraft((d) => ({ ...d, themeId: id }));
  const setCustomColor = (key: keyof SeedColors, value: string) => {
    const next = { ...seed, [key]: value };
    setSeed(next);
    setDraft((d) => ({ ...d, themeId: "custom", customPalette: expandPalette(next) }));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await getSupabase().from("restaurants").update({ appearance: draft }).eq("id", restaurant.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.(draft);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Controls */}
      <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        {/* Theme */}
        <section className="flex flex-col gap-3">
          <h2 className="font-extrabold text-[15px] text-ink">{tx.themeTitle}</h2>
          <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{tx.builtinThemes}</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {builtins.map((th) => (
              <ThemeSwatch key={th.id} preset={th} selected={draft.themeId === th.id} label={tr(th.name_i18n)} onClick={() => pickTheme(th.id)} />
            ))}
          </div>

          {extracted.length > 0 && (
            <>
              <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase mt-1">{tx.extractedThemes}</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {extracted.map((th) => (
                  <ThemeSwatch key={th.id} preset={th} selected={draft.themeId === th.id} label={tr(th.name_i18n) || tx.extractedThemes} onClick={() => pickTheme(th.id)} />
                ))}
              </div>
            </>
          )}

          {/* Custom */}
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, themeId: "custom", customPalette: expandPalette(seed) }))}
            className={`text-start rounded-xl p-3 border-[1.5px] transition-colors cursor-pointer ${
              draft.themeId === "custom" ? "border-harissa bg-harissa-tint/40" : "border-line bg-card hover:border-line-strong"
            }`}
          >
            <span className="font-extrabold text-[13.5px] text-ink">{tx.customTheme}</span>
            <span className="block text-[12px] text-muted-soft">{tx.customHint}</span>
          </button>
          {draft.themeId === "custom" && (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <ColorField label={tx.colorPrimary} value={seed.primary} onChange={(v) => setCustomColor("primary", v)} />
              <ColorField label={tx.colorAccent} value={seed.accent} onChange={(v) => setCustomColor("accent", v)} />
              <ColorField label={tx.colorBackground} value={seed.background} onChange={(v) => setCustomColor("background", v)} />
              <ColorField label={tx.colorText} value={seed.text} onChange={(v) => setCustomColor("text", v)} />
            </div>
          )}
        </section>

        {/* Layout */}
        <section className="flex flex-col gap-3">
          <h2 className="font-extrabold text-[15px] text-ink">{tx.layoutTitle}</h2>

          <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{tx.categoryLayout}</span>
          <div className="grid grid-cols-3 gap-2.5">
            {CATEGORY_LAYOUTS.map((layout) => (
              <LayoutThumb
                key={layout}
                selected={draft.categoryLayout === layout}
                label={tx.layouts[layout]}
                onClick={() => setDraft((d) => ({ ...d, categoryLayout: layout }))}
              >
                <CategoryThumb layout={layout} />
              </LayoutThumb>
            ))}
          </div>

          <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase mt-1">{tx.itemLayout}</span>
          <div className="grid grid-cols-3 gap-2.5">
            {ITEM_LAYOUTS.map((layout) => (
              <LayoutThumb
                key={layout}
                selected={draft.itemLayout === layout}
                label={tx.layouts[layout === "list" ? "itemList" : layout]}
                onClick={() => setDraft((d) => ({ ...d, itemLayout: layout }))}
              >
                <ItemThumb layout={layout} />
              </LayoutThumb>
            ))}
          </div>

          <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase mt-1">{tx.imageStyle}</span>
          <span className="-mt-2 text-[12px] text-muted-soft">{tx.imageStyleHint}</span>
          <div className="grid grid-cols-3 gap-2.5">
            {IMAGE_STYLES.map((style) => (
              <LayoutThumb
                key={style}
                selected={draft.imageStyle === style}
                label={tx.imageStyles[style]}
                onClick={() => setDraft((d) => ({ ...d, imageStyle: style }))}
              >
                <ImageStyleThumb style={style} />
              </LayoutThumb>
            ))}
          </div>

          <label className="flex items-center justify-between gap-3 bg-card border border-line rounded-xl px-3.5 py-3 mt-1">
            <span className="flex flex-col">
              <span className="font-extrabold text-[13.5px] text-ink">{tx.showLanding}</span>
              <span className="text-[12px] text-muted-soft">{tx.showLandingHint}</span>
            </span>
            <Toggle checked={draft.showCategoryLanding} onChange={(v) => setDraft((d) => ({ ...d, showCategoryLanding: v }))} />
          </label>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-11 px-6 rounded-lg bg-harissa text-white font-extrabold text-sm shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none"
          >
            {t.common.save}
          </button>
          {saved && <span className="text-xs font-extrabold text-success-text bg-success-tint rounded-full px-3 py-1.5">✓ {tx.saved}</span>}
        </div>
      </div>

      {/* Live preview */}
      <div className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-4">
        <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{tx.preview}</span>
        <div className="mt-2 rounded-[28px] border-[6px] border-ink/85 overflow-hidden shadow-xl">
          <div style={paletteToCssVars(palette) as CSSProperties} className="bg-cream h-[520px] overflow-y-auto no-scrollbar">
            <div className="px-4 pt-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-harissa" />
              <span className="font-extrabold text-[13px] text-ink truncate">{restaurant.name}</span>
            </div>
            {draft.showCategoryLanding && draft.categoryLayout !== "classic" ? (
              <CategoryLanding tree={previewTree} layout={draft.categoryLayout} imageStyle={draft.imageStyle} itemCountByCategory={previewCounts} onSelect={() => {}} />
            ) : (
              <ClassicPreview palette={palette} tree={previewTree} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- small building blocks ----

function ThemeSwatch({ preset, selected, label, onClick }: { preset: ThemePreset; selected: boolean; label: string; onClick: () => void }) {
  const p = preset.palette;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-start rounded-xl p-2.5 border-[1.5px] transition-colors cursor-pointer ${
        selected ? "border-harissa" : "border-line hover:border-line-strong"
      }`}
    >
      <div className="h-10 rounded-lg flex overflow-hidden border border-line" style={{ background: p.bg }}>
        <span className="flex-1" style={{ background: p.primary }} />
        <span className="flex-1" style={{ background: p.accent }} />
        <span className="flex-1" style={{ background: p.card }} />
        <span className="flex-1" style={{ background: p.ink }} />
      </div>
      <span className="block mt-1.5 font-bold text-[12px] text-ink truncate">{label}</span>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 bg-card border border-line rounded-lg px-2.5 py-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0" />
      <span className="flex flex-col min-w-0">
        <span className="text-[11.5px] font-bold text-ink truncate">{label}</span>
        <span className="text-[10.5px] text-muted-soft uppercase" dir="ltr">{value}</span>
      </span>
    </label>
  );
}

function LayoutThumb({ selected, label, onClick, children }: { selected: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-1.5 rounded-xl p-2 border-[1.5px] transition-colors cursor-pointer ${
        selected ? "border-harissa bg-harissa-tint/30" : "border-line bg-card hover:border-line-strong"
      }`}
    >
      <div className="h-[58px] rounded-md bg-sand border border-line p-1.5 flex items-center justify-center overflow-hidden">{children}</div>
      <span className="text-[11px] font-bold text-ink text-center leading-tight">{label}</span>
    </button>
  );
}

const bar = "bg-line-strong rounded-[2px]";
const block = "bg-line-strong rounded-[3px]";

function ImageStyleThumb({ style }: { style: ImageStyle }) {
  if (style === "illustration") return <MenuArt id="coffee" className="w-11 h-11 rounded-md" />;
  if (style === "plain") return <div className="w-11 h-11 rounded-md bg-harissa-tint" />;
  return <PhotoPlaceholder className="w-11 h-11 rounded-md" />;
}

function CategoryThumb({ layout }: { layout: CategoryLayout }) {
  if (layout === "list")
    return <div className="w-full flex flex-col gap-1">{[0, 1, 2].map((i) => <div key={i} className={`h-2.5 w-full ${bar}`} />)}</div>;
  if (layout === "circles")
    return <div className="flex gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="w-4 h-4 rounded-full bg-line-strong" />)}</div>;
  if (layout === "banner")
    return <div className="w-full flex flex-col gap-1.5">{[0, 1].map((i) => <div key={i} className={`h-4 w-full ${block}`} />)}</div>;
  if (layout === "carousel")
    return <div className="flex gap-1.5">{[0, 1, 2].map((i) => <div key={i} className={`w-5 h-8 ${block} shrink-0`} />)}</div>;
  if (layout === "classic")
    return (
      <div className="w-full flex flex-col gap-1">
        <div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className="h-2 w-3 rounded-full bg-line-strong" />)}</div>
        {[0, 1].map((i) => <div key={i} className={`h-2 w-full ${bar}`} />)}
      </div>
    );
  return <div className="grid grid-cols-2 gap-1.5 w-full">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-5 ${block}`} />)}</div>;
}

function ItemThumb({ layout }: { layout: ItemLayout }) {
  if (layout === "cards") return <div className="grid grid-cols-2 gap-1.5 w-full">{[0, 1].map((i) => <div key={i} className={`h-8 ${block}`} />)}</div>;
  if (layout === "compact")
    return (
      <div className="w-full flex flex-col gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1"><div className="w-2 h-2 bg-line-strong rounded-[2px]" /><div className={`h-1.5 flex-1 ${bar}`} /></div>
        ))}
      </div>
    );
  return (
    <div className="w-full flex flex-col gap-1.5">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-1.5"><div className="w-4 h-4 bg-line-strong rounded-[3px]" /><div className="flex-1 flex flex-col gap-1"><div className={`h-1.5 w-3/4 ${bar}`} /><div className={`h-1.5 w-1/2 ${bar}`} /></div></div>
      ))}
    </div>
  );
}

function ClassicPreview({ palette, tree }: { palette: ThemePalette; tree: ReturnType<typeof buildCategoryTree> }) {
  const { tr } = useI18n();
  return (
    <div className="px-4 pt-3 flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {tree.map((c, i) => (
          <span
            key={c.id}
            className="shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1"
            style={i === 0 ? { background: palette.ink, color: palette.bg } : { background: palette.card, color: palette.muted, border: `1px solid ${palette.line}` }}
          >
            {tr(c.name_i18n)}
          </span>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-2 items-center rounded-lg p-2" style={{ background: palette.card, border: `1px solid ${palette.line}` }}>
          <div className="w-10 h-10 rounded-md" style={{ background: palette.photo }} />
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-2 w-2/3 rounded" style={{ background: palette.lineStrong }} />
            <div className="h-2 w-1/3 rounded" style={{ background: palette.line }} />
          </div>
        </div>
      ))}
    </div>
  );
}
