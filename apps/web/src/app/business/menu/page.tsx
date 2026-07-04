"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  millimesToDisplay,
  type Category,
  type Language,
  type MenuItem,
  type Modifier,
  type ModifierGroup,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPlaceholder, Toggle } from "@/components/ui";
import { usePortal } from "../portal-provider";
import { ConfirmDialog } from "../confirm-dialog";
import { ItemEditor } from "./item-editor";

/** W3 · Menu management — categories, items, availability, trilingual completeness. */
export default function MenuManagementPage() {
  const { restaurant, canManage } = usePortal();
  const { t, tr, lang } = useI18n();
  const supabase = getSupabase();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [groups, setGroups] = useState<(ModifierGroup & { modifiers: Modifier[] })[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | "new" | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Menu management is owner/manager only — RLS silently discards writes
  // from other roles, so don't even show them the page.
  useEffect(() => {
    if (!canManage) router.replace("/business/orders");
  }, [canManage, router]);

  const reload = useCallback(async () => {
    const [{ data: cats }, { data: its }, { data: grps }, { data: mods }] = await Promise.all([
      supabase.from("categories").select("*").eq("restaurant_id", restaurant.id).order("sort_order").overrideTypes<Category[], { merge: false }>(),
      supabase.from("items").select("*").eq("restaurant_id", restaurant.id).order("sort_order").overrideTypes<MenuItem[], { merge: false }>(),
      supabase.from("modifier_groups").select("*").eq("restaurant_id", restaurant.id).order("sort_order").overrideTypes<Omit<ModifierGroup, "modifiers">[]>(),
      supabase.from("modifiers").select("*").eq("restaurant_id", restaurant.id).order("sort_order").overrideTypes<Modifier[], { merge: false }>(),
    ]);
    setCategories(cats ?? []);
    setItems(its ?? []);
    setGroups((grps ?? []).map((g) => ({ ...g, modifiers: (mods ?? []).filter((m) => m.group_id === g.id) })));
    setActiveCategory((prev) => prev ?? cats?.[0]?.id ?? null);
  }, [restaurant.id, supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const flashSaved = (ok: boolean, label: string = t.portal.menu.published) => {
    setSaveError(!ok);
    setSavedFlash(ok ? label : null);
    setTimeout(() => {
      setSavedFlash(null);
      setSaveError(false);
    }, 2500);
  };

  const visibleItems = useMemo(
    () => items.filter((i) => i.category_id === activeCategory),
    [items, activeCategory],
  );

  const toggleAvailability = async (item: MenuItem, available: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: available } : i)));
    const { error } = await supabase
      .from("items")
      .update({ is_available: available })
      .eq("id", item.id)
      .select("id")
      .single();
    if (error) {
      // RLS or network rejected the write: revert the optimistic flip.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !available } : i)));
    }
    flashSaved(!error, t.portal.menu.availabilitySaved);
  };

  const addCategory = async () => {
    const name = window.prompt(t.portal.menu.categoryName);
    if (!name?.trim()) return;
    const { error } = await supabase.from("categories").insert({
      restaurant_id: restaurant.id,
      name_i18n: { [lang]: name.trim() },
      sort_order: categories.length,
    });
    await reload();
    flashSaved(!error);
  };

  const confirmDeleteCategory = async () => {
    const cat = categoryToDelete;
    setCategoryToDelete(null);
    if (!cat) return;
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (activeCategory === cat.id) setActiveCategory(null);
    await reload();
    flashSaved(!error);
  };

  const moveItem = async (item: MenuItem, dir: -1 | 1) => {
    const siblings = visibleItems;
    const index = siblings.findIndex((i) => i.id === item.id);
    const swapWith = siblings[index + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("items").update({ sort_order: swapWith.sort_order }).eq("id", item.id),
      supabase.from("items").update({ sort_order: item.sort_order }).eq("id", swapWith.id),
    ]);
    await reload();
  };

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-3.5 flex-wrap">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.portal.menu.title}</h1>
        {savedFlash && (
          <span className="text-xs font-extrabold text-success-text bg-success-tint rounded-full px-3 py-1.5">
            ✓ {savedFlash}
          </span>
        )}
        {saveError && (
          <span className="text-xs font-extrabold text-danger-text bg-danger-tint rounded-full px-3 py-1.5">
            {t.errors.generic}
          </span>
        )}
        <div className="flex-1" />
        <a
          href={`/r/${restaurant.slug}/t/preview`}
          onClick={(e) => {
            e.preventDefault();
            // Preview through the first table's QR link.
            void supabase
              .from("tables")
              .select("qr_token")
              .eq("restaurant_id", restaurant.id)
              .order("sort_order")
              .limit(1)
              .maybeSingle()
              .then(({ data }) => {
                // Prefer a real table's scanned menu; fall back to the browse
                // venue page when the venue has no tables yet (so Preview is
                // never a dead click).
                window.open(
                  data ? `/r/${restaurant.slug}/t/${data.qr_token}/menu` : `/r/${restaurant.slug}`,
                  "_blank",
                );
              });
          }}
          className="text-[13px] font-extrabold text-ink border-[1.5px] border-line-strong bg-card rounded-md px-4 py-2.5 cursor-pointer hover:border-ink transition-colors"
        >
          {t.portal.menu.preview}
        </a>
        <button
          type="button"
          disabled={!activeCategory}
          title={!activeCategory ? t.portal.menu.addCategory : undefined}
          onClick={() => setEditingItem("new")}
          className="text-[13px] font-extrabold text-white bg-harissa rounded-md px-4 py-2.5 shadow-[0_4px_12px_rgba(188,75,38,0.25)] cursor-pointer hover:bg-harissa-pressed transition-colors disabled:bg-disabled disabled:shadow-none disabled:cursor-default"
        >
          {t.portal.menu.addItem}
        </button>
      </div>

      <div className="flex-1 flex gap-4 px-6 pb-5 items-start">
        {/* Categories rail */}
        <div className="w-[200px] shrink-0 flex flex-col gap-1.5">
          {categories.map((cat) => {
            const active = cat.id === activeCategory;
            const count = items.filter((i) => i.category_id === cat.id).length;
            return (
              <div key={cat.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center justify-between rounded-md px-3.5 py-3 cursor-pointer transition-colors ${
                    active ? "bg-ink" : "bg-card border border-line hover:border-line-strong"
                  }`}
                >
                  <span className={`text-[13px] truncate ${active ? "font-extrabold text-cream" : "font-bold text-muted"}`}>
                    {tr(cat.name_i18n)}
                  </span>
                  <span className={`text-[11.5px] font-extrabold ${active ? "text-cream/60" : "text-disabled"}`}>{count}</span>
                </button>
                <button
                  type="button"
                  aria-label={t.common.delete}
                  onClick={() => setCategoryToDelete(cat)}
                  className="absolute -top-1.5 -end-1.5 hidden group-hover:flex w-5 h-5 rounded-full bg-danger text-white text-[10px] font-extrabold items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => void addCategory()}
            className="border-[1.5px] border-dashed border-line-dashed rounded-md px-3.5 py-3 text-muted-soft font-extrabold text-[12.5px] cursor-pointer hover:border-harissa hover:text-harissa transition-colors"
          >
            {t.portal.menu.addCategory}
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center px-3.5 gap-3">
            <span className="w-12" />
            <span className="flex-1 text-[11px] font-extrabold text-muted-soft tracking-wider">{t.portal.menu.itemColumn}</span>
            <span className="w-[110px] text-[11px] font-extrabold text-muted-soft tracking-wider">{t.portal.menu.languagesColumn}</span>
            <span className="w-16 text-end text-[11px] font-extrabold text-muted-soft tracking-wider">{t.portal.menu.priceColumn}</span>
            <span className="w-[90px] text-center text-[11px] font-extrabold text-muted-soft tracking-wider">
              {t.portal.menu.availableColumn}
            </span>
            <span className="w-[74px]" />
          </div>

          {visibleItems.map((item, index) => {
            const soldOut = !item.is_available;
            return (
              <div
                key={item.id}
                className={`rounded-lg border px-3.5 py-2.5 flex items-center gap-3 ${
                  soldOut ? "bg-sand border-line opacity-75" : "bg-card border-line"
                }`}
              >
                <div className="w-12 flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="up"
                    disabled={index === 0}
                    onClick={() => void moveItem(item, -1)}
                    className="text-disabled hover:text-ink disabled:opacity-30 cursor-pointer text-xs font-extrabold"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="down"
                    disabled={index === visibleItems.length - 1}
                    onClick={() => void moveItem(item, 1)}
                    className="text-disabled hover:text-ink disabled:opacity-30 cursor-pointer text-xs font-extrabold"
                  >
                    ▼
                  </button>
                </div>
                <PhotoPlaceholder src={item.photo_url} alt="" className="w-11 h-11 rounded-md shrink-0" />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className={`font-extrabold text-sm truncate ${soldOut ? "text-muted line-through" : "text-ink"}`}>
                    {tr(item.name_i18n)}
                  </span>
                  {soldOut && (
                    <span className="text-[10.5px] font-extrabold text-muted-soft bg-sand-deep rounded-full px-2 py-0.5 shrink-0">
                      {t.menu.soldOut}
                    </span>
                  )}
                  {item.is_popular && !soldOut && (
                    <span className="text-[10.5px] font-extrabold text-harissa-pressed bg-harissa-tint rounded-full px-2 py-0.5 shrink-0">
                      {t.menu.popular}
                    </span>
                  )}
                </div>
                <div className="w-[110px] flex gap-1" dir="ltr">
                  {(restaurant.languages as Language[]).map((code) => {
                    const has = Boolean(item.name_i18n[code]);
                    return (
                      <span
                        key={code}
                        title={has ? undefined : t.portal.menu.missingTranslation}
                        className={`text-[10px] font-extrabold rounded px-1.5 py-0.5 uppercase ${
                          has ? "text-teal-pressed bg-teal-tint" : "text-warning-text bg-warning-tint"
                        }`}
                      >
                        {code}
                        {!has && " ?"}
                      </span>
                    );
                  })}
                </div>
                <span className="w-16 text-end font-extrabold text-sm text-ink" dir="ltr">
                  {millimesToDisplay(item.price_millimes, lang)}
                </span>
                <div className="w-[90px] flex justify-center">
                  <Toggle checked={item.is_available} onChange={(v) => void toggleAvailability(item, v)} />
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(item)}
                  className="w-[74px] text-[12.5px] font-extrabold text-ink border-[1.5px] border-line-strong rounded-md py-1.5 cursor-pointer hover:border-harissa hover:text-harissa-pressed transition-colors"
                >
                  {t.portal.menu.editItem}
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setEditingItem("new")}
            className="border-[1.5px] border-dashed border-line-dashed rounded-lg py-3.5 text-muted-soft font-extrabold text-[13px] cursor-pointer hover:border-harissa hover:text-harissa transition-colors"
          >
            {t.portal.menu.addItem}
          </button>
        </div>

        {/* Editor panel — keyed so switching items never carries form state across. */}
        {editingItem && activeCategory && (
          <ItemEditor
            key={editingItem === "new" ? "new" : editingItem.id}
            item={editingItem === "new" ? null : editingItem}
            categoryId={editingItem === "new" ? activeCategory : editingItem.category_id}
            groups={editingItem === "new" ? [] : groups.filter((g) => g.item_id === editingItem.id)}
            nextSortOrder={
              editingItem === "new"
                ? Math.max(0, ...items.filter((i) => i.category_id === activeCategory).map((i) => i.sort_order + 1))
                : undefined
            }
            onClose={() => setEditingItem(null)}
            onSaved={(ok) => {
              setEditingItem(null);
              void reload();
              flashSaved(ok);
            }}
          />
        )}
      </div>

      {categoryToDelete && (
        <ConfirmDialog
          body={t.portal.menu.deleteCategoryConfirm}
          onConfirm={() => void confirmDeleteCategory()}
          onCancel={() => setCategoryToDelete(null)}
        />
      )}
    </div>
  );
}
