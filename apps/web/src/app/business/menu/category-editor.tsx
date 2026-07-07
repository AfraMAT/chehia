"use client";

import { useState } from "react";
import type { Category, I18nText, Language, Restaurant } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPlaceholder, Spinner } from "@/components/ui";

/** Create / edit a category or subcategory: name (i18n), parent, icon, image. */
export function CategoryEditor({
  restaurant,
  category,
  parentId,
  topLevel,
  hasChildren = false,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  restaurant: Restaurant;
  /** Existing category to edit, or null to create. */
  category: Category | null;
  /** Preselected parent when creating a subcategory. */
  parentId?: string | null;
  /** Top-level categories available as parents. */
  topLevel: Category[];
  /** True when the edited category already has subcategories (so it can't be reparented). */
  hasChildren?: boolean;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (ok: boolean) => void;
}) {
  const { t, tr } = useI18n();
  const tx = t.portal.menu;
  const supabase = getSupabase();
  const languages = restaurant.languages as Language[];

  const [name, setName] = useState<I18nText>(category?.name_i18n ?? {});
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(category?.image_url ?? null);
  const [parent, setParent] = useState<string | null>(category ? category.parent_id : parentId ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const onPickImage = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type) || file.size > 5_000_000) {
      setError(true);
      return;
    }
    setUploading(true);
    setError(false);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${restaurant.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("item-photos").upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) {
      setError(true);
      setUploading(false);
      return;
    }
    setImageUrl(supabase.storage.from("item-photos").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    if (!name[languages[0] ?? "fr"]?.trim()) {
      setError(true);
      return;
    }
    setSaving(true);
    setError(false);
    const payload = {
      name_i18n: name,
      icon: icon.trim() || null,
      image_url: imageUrl,
      parent_id: parent,
    };
    const { error: err } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert({ ...payload, restaurant_id: restaurant.id, sort_order: nextSortOrder });
    setSaving(false);
    if (err) {
      setError(true);
      return;
    }
    onSaved(true);
  };

  const inputCls =
    "h-9 rounded-md border-[1.5px] border-line-strong bg-white px-2.5 text-[13px] font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  return (
    <div className="fixed inset-0 z-50 bg-ink/45 flex items-stretch sm:items-center justify-center sm:p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[460px] bg-card sm:border border-line sm:rounded-2xl shadow-xl flex flex-col min-h-dvh sm:min-h-0"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <h2 className="font-display font-extrabold text-lg text-ink">{category ? tx.editCategory : parent ? tx.subcategory : tx.addCategory}</h2>
          <button type="button" aria-label={t.common.close} onClick={onClose} className="text-muted-soft font-extrabold text-lg cursor-pointer">✕</button>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5">
          {/* Name per language */}
          <div className="flex flex-col gap-2">
            {languages.map((code) => (
              <div key={code} className="flex items-center gap-2">
                <span className="w-8 text-[11px] font-extrabold text-muted-soft uppercase">{code}</span>
                <input
                  dir={code === "ar" ? "rtl" : "ltr"}
                  className={inputCls}
                  placeholder={tx.categoryName}
                  value={name[code] ?? ""}
                  onChange={(e) => setName((n) => ({ ...n, [code]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {/* Parent */}
          {!hasChildren && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{tx.parentCategory}</span>
              <select className={inputCls} value={parent ?? ""} onChange={(e) => setParent(e.target.value || null)}>
                <option value="">{tx.topLevel}</option>
                {topLevel
                  .filter((c) => c.id !== category?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{tr(c.name_i18n)}</option>
                  ))}
              </select>
            </label>
          )}

          {/* Icon + Image */}
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 w-24">
              <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{tx.categoryIcon}</span>
              <input className={`${inputCls} text-center text-[18px]`} maxLength={2} placeholder="🍽️" value={icon} onChange={(e) => setIcon(e.target.value)} />
            </label>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{tx.categoryImage}</span>
              <label className="relative h-16 rounded-lg border-[1.5px] border-dashed border-line-dashed flex items-center justify-center cursor-pointer hover:border-harissa transition-colors overflow-hidden">
                {imageUrl ? (
                  <PhotoPlaceholder src={imageUrl} alt="" className="absolute inset-0 w-full h-full" />
                ) : uploading ? (
                  <Spinner className="text-harissa" />
                ) : (
                  <span className="text-[12px] font-bold text-muted-soft">{tx.photoHint ?? "＋"}</span>
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) void onPickImage(e.target.files[0]); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          {error && <p className="text-[13px] font-bold text-danger-text">{t.errors.generic}</p>}
        </div>

        <div className="border-t border-line px-5 py-3 flex items-center gap-2.5">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-lg border-[1.5px] border-line-strong text-ink font-extrabold text-[13.5px] cursor-pointer hover:bg-sand transition-colors">
            {t.common.cancel}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="flex-1 h-11 rounded-lg bg-harissa text-white font-extrabold text-[13.5px] flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none">
            {saving ? <Spinner /> : t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
