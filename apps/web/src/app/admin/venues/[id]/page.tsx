"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildCategoryTree, type Category, type Restaurant } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { Logo } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { useAdmin } from "../../admin-provider";
import { AppearanceStudio } from "@/app/business/appearance/appearance-studio";
import { CategoryEditor } from "@/app/business/menu/category-editor";
import { ConfirmDialog } from "@/app/business/confirm-dialog";

type EditingCat = { category: Category | null; parentId: string | null; hasChildren: boolean };

/** Admin per-venue management: appearance + category/subcategory tree for any venue. */
export default function AdminVenuePage() {
  useAdmin(); // provider guards platform-admin access
  const { t, tr } = useI18n();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = getSupabase();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<"appearance" | "menu">("appearance");
  const [editingCat, setEditingCat] = useState<EditingCat | null>(null);
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);

  const loadRestaurant = useCallback(async () => {
    const { data } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle<Restaurant>();
    setRestaurant(data ?? null);
  }, [id, supabase]);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", id)
      .order("sort_order")
      .overrideTypes<Category[], { merge: false }>();
    setCategories(data ?? []);
  }, [id, supabase]);

  useEffect(() => {
    void loadRestaurant();
    void loadCategories();
  }, [loadRestaurant, loadCategories]);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const topLevel = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  const confirmDelete = async () => {
    const cat = catToDelete;
    setCatToDelete(null);
    if (!cat) return;
    await supabase.from("categories").delete().eq("id", cat.id);
    await loadCategories();
  };

  if (!restaurant) {
    return (
      <div className="min-h-dvh bg-sand flex items-center justify-center">
        <span className="w-8 h-8 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const catRow = (cat: Category, depth: 0 | 1) => {
    const hasChildren = depth === 0 && (tree.find((n) => n.id === cat.id)?.children.length ?? 0) > 0;
    return (
      <div key={cat.id} className="group relative flex items-center gap-2">
        <div className={`flex-1 flex items-center gap-2 bg-card border border-line rounded-lg ${depth ? "ms-6 px-3 py-2" : "px-3.5 py-2.5"}`}>
          {depth === 1 && <span className="text-muted-soft" aria-hidden>↳</span>}
          {cat.icon && <span aria-hidden>{cat.icon}</span>}
          <span className="font-bold text-[13.5px] text-ink truncate flex-1">{tr(cat.name_i18n)}</span>
          <button type="button" onClick={() => setEditingCat({ category: cat, parentId: cat.parent_id, hasChildren })} className="text-[12px] font-extrabold text-muted hover:text-harissa cursor-pointer">
            {t.common.edit}
          </button>
          <button type="button" onClick={() => setCatToDelete(cat)} className="text-[12px] font-extrabold text-muted hover:text-danger-text cursor-pointer">
            ✕
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-sand">
      <header className="bg-card border-b border-line sticky top-0 z-10">
        <div className="max-w-[960px] mx-auto px-6 h-16 flex items-center gap-4">
          <Logo markSize={28} textSize={17} />
          <Link href="/admin" className="text-[12px] font-extrabold text-muted hover:text-ink cursor-pointer">
            {t.admin.backToVenues}
          </Link>
          <div className="flex-1" />
          <span className="font-extrabold text-[14px] text-ink truncate">{restaurant.name}</span>
        </div>
      </header>

      <main className="max-w-[960px] mx-auto px-6 py-6 flex flex-col gap-4">
        <div className="flex gap-1 bg-sand-deep rounded-lg p-1 self-start">
          {(["appearance", "menu"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`h-8 px-4 rounded-md text-[13px] font-extrabold cursor-pointer transition-colors ${
                tab === k ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {k === "appearance" ? t.admin.venueAppearance : t.admin.venueMenu}
            </button>
          ))}
        </div>

        {tab === "appearance" ? (
          <div className="bg-card border border-line rounded-2xl p-5">
            <AppearanceStudio restaurant={restaurant} categories={categories} onSaved={() => void loadRestaurant()} />
          </div>
        ) : (
          <div className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-2 max-w-[520px]">
            <h2 className="font-extrabold text-[15px] text-ink mb-1">{t.admin.venueMenu}</h2>
            {tree.map((node) => (
              <div key={node.id} className="flex flex-col gap-1.5">
                {catRow(node, 0)}
                {node.children.map((sub) => catRow(sub, 1))}
                <button
                  type="button"
                  onClick={() => setEditingCat({ category: null, parentId: node.id, hasChildren: false })}
                  className="ms-6 text-start text-[11.5px] font-extrabold text-muted-soft hover:text-harissa cursor-pointer"
                >
                  {t.portal.menu.addSubcategory}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditingCat({ category: null, parentId: null, hasChildren: false })}
              className="mt-1 border-[1.5px] border-dashed border-line-dashed rounded-lg px-3.5 py-2.5 text-muted-soft font-extrabold text-[12.5px] cursor-pointer hover:border-harissa hover:text-harissa transition-colors"
            >
              {t.portal.menu.addCategory}
            </button>
          </div>
        )}
      </main>

      {editingCat && (
        <CategoryEditor
          restaurant={restaurant}
          category={editingCat.category}
          parentId={editingCat.parentId}
          topLevel={topLevel}
          hasChildren={editingCat.hasChildren}
          nextSortOrder={
            editingCat.category
              ? editingCat.category.sort_order
              : editingCat.parentId
                ? tree.find((n) => n.id === editingCat.parentId)?.children.length ?? 0
                : topLevel.length
          }
          onClose={() => setEditingCat(null)}
          onSaved={() => {
            setEditingCat(null);
            void loadCategories();
          }}
        />
      )}

      {catToDelete && (
        <ConfirmDialog
          body={catToDelete.parent_id ? t.portal.menu.deleteSubcategoryConfirm : t.portal.menu.deleteCategoryConfirm}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setCatToDelete(null)}
        />
      )}
    </div>
  );
}
