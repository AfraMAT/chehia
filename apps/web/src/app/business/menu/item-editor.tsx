"use client";

import { useRef, useState } from "react";
import {
  type I18nText,
  type Language,
  type MenuItem,
  type Modifier,
  type ModifierGroup,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPlaceholder, Toggle } from "@/components/ui";
import { usePortal } from "../portal-provider";

interface EditableModifier {
  id?: string;
  name_i18n: I18nText;
  /** Kept as typed text so the field is freely editable; parsed at save. */
  deltaText: string;
}

interface EditableGroup {
  id?: string;
  name_i18n: I18nText;
  min_select: number;
  max_select: number;
  modifiers: EditableModifier[];
}

/** W3 side panel · trilingual item editor with option groups. */
export function ItemEditor({
  item,
  categoryId,
  groups,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  categoryId: string;
  groups: (ModifierGroup & { modifiers: Modifier[] })[];
  /** Sort position for a newly created item (max of its category + 1). */
  nextSortOrder?: number;
  onClose: () => void;
  onSaved: (ok: boolean) => void;
}) {
  const { restaurant } = usePortal();
  const { t, tr } = useI18n();
  const supabase = getSupabase();
  const languages = restaurant.languages as Language[];

  const [editLang, setEditLang] = useState<Language>(languages[0] ?? "fr");
  const [name, setName] = useState<I18nText>(item?.name_i18n ?? {});
  const [description, setDescription] = useState<I18nText>(item?.description_i18n ?? {});
  const [price, setPrice] = useState(item ? (item.price_millimes / 1000).toFixed(3) : "");
  const [available, setAvailable] = useState(item?.is_available ?? true);
  const [popular, setPopular] = useState(item?.is_popular ?? false);
  const [editGroups, setEditGroups] = useState<EditableGroup[]>(
    groups.map((g) => ({
      id: g.id,
      name_i18n: g.name_i18n,
      min_select: g.min_select,
      max_select: g.max_select,
      modifiers: g.modifiers.map((m) => ({
        id: m.id,
        name_i18n: m.name_i18n,
        deltaText: (m.price_delta_millimes / 1000).toFixed(3),
      })),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePrice = (value: string): number | null => {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 1000);
  };

  // Upload to the tenant-scoped folder (<restaurant_id>/…); storage RLS rejects
  // writes outside the caller's own restaurant.
  const onPickPhoto = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type) || file.size > 5_000_000) {
      setError(t.errors.generic);
      return;
    }
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${restaurant.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("item-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) {
      setError(t.errors.generic);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    const millimes = parsePrice(price);
    if (millimes === null || !name[languages[0] ?? "fr"]) {
      setError(t.errors.generic);
      return;
    }
    setSaving(true);
    setError(null);
    // Any failed statement below surfaces as an error instead of a phantom "saved".
    let failed = false;
    const track = <T,>(result: { error: unknown; data?: T }): T | undefined => {
      if (result.error) failed = true;
      return result.data;
    };
    try {
      let itemId = item?.id;
      const payload = {
        name_i18n: name,
        description_i18n: description,
        price_millimes: millimes,
        is_available: available,
        is_popular: popular,
        photo_url: photoUrl,
      };
      if (itemId) {
        const { error: e } = await supabase.from("items").update(payload).eq("id", itemId).select("id").single();
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from("items")
          .insert({
            ...payload,
            restaurant_id: restaurant.id,
            category_id: categoryId,
            sort_order: nextSortOrder ?? 0,
          })
          .select("id")
          .single();
        if (e || !data) throw e ?? new Error("insert failed");
        itemId = data.id as string;
      }

      // Reconcile modifier groups: delete removed, upsert the rest.
      const keptGroupIds = editGroups.map((g) => g.id).filter(Boolean) as string[];
      const removedGroups = groups.filter((g) => !keptGroupIds.includes(g.id));
      for (const g of removedGroups) {
        track(await supabase.from("modifier_groups").delete().eq("id", g.id));
      }
      for (const [gi, group] of editGroups.entries()) {
        let groupId = group.id;
        const groupPayload = {
          name_i18n: group.name_i18n,
          min_select: group.min_select,
          max_select: Math.max(group.max_select, 1),
          sort_order: gi,
        };
        if (groupId) {
          track(await supabase.from("modifier_groups").update(groupPayload).eq("id", groupId));
        } else {
          const data = track(
            await supabase
              .from("modifier_groups")
              .insert({ ...groupPayload, restaurant_id: restaurant.id, item_id: itemId })
              .select("id")
              .single(),
          );
          groupId = (data as { id: string } | undefined)?.id;
        }
        if (!groupId) {
          failed = true;
          continue;
        }

        const keptModIds = group.modifiers.map((m) => m.id).filter(Boolean) as string[];
        const original = groups.find((g) => g.id === group.id);
        for (const m of original?.modifiers ?? []) {
          if (!keptModIds.includes(m.id)) track(await supabase.from("modifiers").delete().eq("id", m.id));
        }
        for (const [mi, mod] of group.modifiers.entries()) {
          const parsed = Number(mod.deltaText.replace(",", "."));
          const modPayload = {
            name_i18n: mod.name_i18n,
            price_delta_millimes: Number.isFinite(parsed) ? Math.round(parsed * 1000) : 0,
            sort_order: mi,
          };
          if (mod.id) {
            track(await supabase.from("modifiers").update(modPayload).eq("id", mod.id));
          } else {
            track(
              await supabase.from("modifiers").insert({ ...modPayload, restaurant_id: restaurant.id, group_id: groupId }),
            );
          }
        }
      }

      if (failed) {
        setError(t.errors.generic);
        return;
      }
      onSaved(true);
    } catch {
      setError(t.errors.generic);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!window.confirm(t.portal.menu.deleteItemConfirm)) return;
    const { error: e } = await supabase.from("items").delete().eq("id", item.id);
    onSaved(!e);
  };

  const inputClass =
    "h-10 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13.5px] font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  return (
    <div className="w-[340px] shrink-0 bg-card border border-line rounded-2xl p-4.5 flex flex-col gap-3.5 sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-[15px] text-ink truncate">
          {item ? `${t.portal.menu.editItem} — ${tr(item.name_i18n)}` : t.portal.menu.newItem}
        </span>
        <button type="button" aria-label={t.common.close} onClick={onClose} className="text-muted-soft font-extrabold cursor-pointer">
          ✕
        </button>
      </div>

      {/* Language tabs */}
      <div className="flex gap-1.5" dir="ltr">
        {languages.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setEditLang(code)}
            className={`flex-1 h-[34px] rounded-sm font-bold text-xs cursor-pointer transition-colors ${
              editLang === code ? "bg-ink text-cream font-extrabold" : "border-[1.5px] border-line-strong text-muted"
            }`}
          >
            {code === "fr" ? "Français" : code === "ar" ? "العربية" : "English"}
          </button>
        ))}
      </div>

      <Field label={t.portal.menu.name}>
        <input
          dir={editLang === "ar" ? "rtl" : "ltr"}
          className={inputClass}
          value={name[editLang] ?? ""}
          onChange={(e) => setName((prev) => ({ ...prev, [editLang]: e.target.value }))}
        />
      </Field>

      <Field label={t.portal.menu.description}>
        <textarea
          dir={editLang === "ar" ? "rtl" : "ltr"}
          rows={2}
          className="rounded-md border-[1.5px] border-line-strong bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-harissa transition-colors w-full resize-none"
          value={description[editLang] ?? ""}
          onChange={(e) => setDescription((prev) => ({ ...prev, [editLang]: e.target.value }))}
        />
      </Field>

      <div className="flex gap-2.5">
        <Field label={t.portal.menu.price} className="flex-1">
          <input inputMode="decimal" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" />
        </Field>
        <Field label={t.portal.menu.available} className="w-[92px]">
          <div className="h-10 flex items-center">
            <Toggle checked={available} onChange={setAvailable} />
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{t.menu.popular}</span>
        <Toggle checked={popular} onChange={setPopular} />
      </div>

      {/* Product photo — click to upload (tenant-scoped Supabase Storage). */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="border-[1.5px] border-dashed border-line-dashed rounded-md p-3.5 flex items-center gap-3 text-start hover:border-harissa transition-colors disabled:opacity-60 cursor-pointer"
      >
        <PhotoPlaceholder src={photoUrl} alt="" className="w-[42px] h-[42px] rounded-md shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-extrabold text-[12.5px] text-ink">{t.portal.menu.photo}</span>
          <span className="text-[11.5px] font-semibold text-muted-soft">
            {uploading ? t.portal.menu.photoUploading : t.portal.menu.photoHint}
          </span>
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickPhoto(f);
          e.target.value = "";
        }}
      />

      {/* Option groups */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{t.portal.menu.optionGroups}</span>
        {editGroups.map((group, gi) => (
          <div key={group.id ?? `new-${gi}`} className="bg-sand rounded-md p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                dir={editLang === "ar" ? "rtl" : "ltr"}
                placeholder={t.portal.menu.groupName}
                className="flex-1 h-8 rounded-sm border border-line-strong bg-white px-2.5 text-xs font-bold text-ink outline-none min-w-0"
                value={group.name_i18n[editLang] ?? ""}
                onChange={(e) =>
                  setEditGroups((prev) =>
                    prev.map((g, i) => (i === gi ? { ...g, name_i18n: { ...g.name_i18n, [editLang]: e.target.value } } : g)),
                  )
                }
              />
              <button
                type="button"
                aria-label={t.common.delete}
                onClick={() => setEditGroups((prev) => prev.filter((_, i) => i !== gi))}
                className="text-muted-soft hover:text-danger font-extrabold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 items-center" dir="ltr">
              <label className="text-[10.5px] font-bold text-muted-soft">{t.portal.menu.minSelect}</label>
              <input
                type="number"
                min={0}
                className="w-12 h-7 rounded-sm border border-line-strong bg-white px-1.5 text-xs font-bold text-center"
                value={group.min_select}
                onChange={(e) =>
                  setEditGroups((prev) =>
                    prev.map((g, i) => (i === gi ? { ...g, min_select: Math.max(0, Number(e.target.value) || 0) } : g)),
                  )
                }
              />
              <label className="text-[10.5px] font-bold text-muted-soft">{t.portal.menu.maxSelect}</label>
              <input
                type="number"
                min={1}
                className="w-12 h-7 rounded-sm border border-line-strong bg-white px-1.5 text-xs font-bold text-center"
                value={group.max_select}
                onChange={(e) =>
                  setEditGroups((prev) =>
                    prev.map((g, i) => (i === gi ? { ...g, max_select: Math.max(1, Number(e.target.value) || 1) } : g)),
                  )
                }
              />
            </div>
            {group.modifiers.map((mod, mi) => (
              <div key={mod.id ?? `newm-${mi}`} className="flex items-center gap-1.5">
                <input
                  dir={editLang === "ar" ? "rtl" : "ltr"}
                  placeholder={t.portal.menu.optionName}
                  className="flex-1 h-8 rounded-sm border border-line-strong bg-white px-2.5 text-xs font-bold text-ink outline-none min-w-0"
                  value={mod.name_i18n[editLang] ?? ""}
                  onChange={(e) =>
                    setEditGroups((prev) =>
                      prev.map((g, i) =>
                        i === gi
                          ? {
                              ...g,
                              modifiers: g.modifiers.map((m, j) =>
                                j === mi ? { ...m, name_i18n: { ...m.name_i18n, [editLang]: e.target.value } } : m,
                              ),
                            }
                          : g,
                      ),
                    )
                  }
                />
                <input
                  inputMode="decimal"
                  dir="ltr"
                  title={t.portal.menu.priceDelta}
                  className="w-[64px] h-8 rounded-sm border border-line-strong bg-white px-1.5 text-xs font-bold text-center outline-none"
                  value={mod.deltaText}
                  onChange={(e) =>
                    setEditGroups((prev) =>
                      prev.map((g, i) =>
                        i === gi
                          ? {
                              ...g,
                              modifiers: g.modifiers.map((m, j) => (j === mi ? { ...m, deltaText: e.target.value } : m)),
                            }
                          : g,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={t.common.delete}
                  onClick={() =>
                    setEditGroups((prev) =>
                      prev.map((g, i) => (i === gi ? { ...g, modifiers: g.modifiers.filter((_, j) => j !== mi) } : g)),
                    )
                  }
                  className="text-muted-soft hover:text-danger font-extrabold text-[10px] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setEditGroups((prev) =>
                  prev.map((g, i) =>
                    i === gi ? { ...g, modifiers: [...g.modifiers, { name_i18n: {}, deltaText: "0" }] } : g,
                  ),
                )
              }
              className="text-[11px] font-extrabold text-muted-soft hover:text-harissa text-start cursor-pointer"
            >
              {t.portal.menu.addOption}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setEditGroups((prev) => [...prev, { name_i18n: {}, min_select: 0, max_select: 1, modifiers: [] }])
          }
          className="border-[1.5px] border-dashed border-line-dashed rounded-md py-2 text-muted-soft font-extrabold text-xs cursor-pointer hover:border-harissa hover:text-harissa transition-colors"
        >
          {t.portal.menu.addOptionGroup}
        </button>
      </div>

      {error && <p className="text-[12.5px] font-bold text-danger-text">{error}</p>}

      <div className="mt-auto flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="h-11 rounded-md bg-ink text-cream font-extrabold text-[13.5px] cursor-pointer disabled:opacity-60"
        >
          {t.common.save}
        </button>
        {item && (
          <button
            type="button"
            onClick={() => void remove()}
            className="h-9 rounded-md text-danger-text font-bold text-[12.5px] hover:bg-danger-tint transition-colors cursor-pointer"
          >
            {t.common.delete}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{label}</span>
      {children}
    </div>
  );
}
