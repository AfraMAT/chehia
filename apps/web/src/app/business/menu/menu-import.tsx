"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractedPresetFromRaw,
  parseMenuPrice,
  validateDraft,
  withExtractedPalette,
  type I18nText,
  type Language,
  type MenuDraft,
  type ThemePreset,
} from "@chehia/shared";
import { callFunction, getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/ui";
import { usePortal } from "../portal-provider";

const MAX_PHOTOS = 4;

interface EditItem {
  keep: boolean;
  name: I18nText;
  description: I18nText;
  /** Editable TND text; re-parsed to millimes at import. Empty = no price. */
  priceText: string;
  dietary_tags?: string[];
}
interface EditCategory {
  keep: boolean;
  name: I18nText;
  items: EditItem[];
}
type Phase = "capture" | "extracting" | "review";

const millimesToText = (m: number): string => (m > 0 ? (m / 1000).toFixed(3) : "");
const hasAnyName = (t: I18nText): boolean => Object.values(t).some((v) => v?.trim());

function draftToEdit(draft: MenuDraft): EditCategory[] {
  return draft.categories.map((c) => ({
    keep: true,
    name: { ...c.name_i18n },
    items: c.items.map((it) => ({
      keep: true,
      name: { ...it.name_i18n },
      description: { ...(it.description_i18n ?? {}) },
      priceText: millimesToText(it.price_millimes),
      dietary_tags: it.dietary_tags,
    })),
  }));
}

/** Downscale + JPEG-compress a photo in the browser → bare base64 (no data: prefix). */
async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode"));
    image.src = dataUrl;
  });
  const maxDim = 1600;
  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, width, height);
  return (canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "");
}

/** Owner/manager tool: photograph a paper menu → AI draft → edit → import. */
export function MenuImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { restaurant } = usePortal();
  const { t } = useI18n();
  const tx = t.portal.menu.import;
  const languages = restaurant.languages as Language[];

  const [phase, setPhase] = useState<Phase>("capture");
  const [photos, setPhotos] = useState<string[]>([]); // bare base64 JPEG
  const [cats, setCats] = useState<EditCategory[]>([]);
  const [editLang, setEditLang] = useState<Language>(languages[0] ?? "fr");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extractedPreset, setExtractedPreset] = useState<ThemePreset | null>(null);
  const importRefRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && phase !== "extracting") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy, phase]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const accepted: string[] = [];
      for (const file of Array.from(files)) {
        // Wrong format is a distinct problem from "too big". We downscale every
        // photo to <=1600px JPEG below, so a large original (phone photos are
        // routinely 3-8MB) is fine — only reject genuinely huge files the
        // browser might struggle to decode.
        if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
          setError(tx.errorBadFile);
          continue;
        }
        if (file.size > 30_000_000) {
          setError(tx.errorTooLarge);
          continue;
        }
        try {
          accepted.push(await compressImage(file));
        } catch {
          setError(tx.errorBadFile);
        }
      }
      if (accepted.length) setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
    },
    [tx],
  );

  /** Map an edge-function failure (HTTP status + error code) to a clear message. */
  const extractErrorMessage = (status: number, code?: string): string => {
    if (code === "rate_limited" || status === 429) return tx.errorRateLimited;
    if (code === "ai_unavailable" || status === 503) return tx.errorUnavailable;
    if (code === "image_too_large" || code === "too_many_images" || status === 413)
      return tx.errorTooLarge;
    if (code === "ai_failed" || status === 502) return tx.errorFailed;
    return t.errors.generic;
  };

  const extract = async () => {
    if (photos.length === 0) return;
    setPhase("extracting");
    setError(null);
    const { ok, status, data } = await callFunction<{ draft?: unknown; error?: { code?: string } }>(
      "extract-menu",
      { restaurant_id: restaurant.id, images: photos },
    );
    if (!ok || !data?.draft) {
      // A failed request means the scan itself broke (service down, rate limit,
      // photos too large…), NOT that the menu is unreadable — surface the real
      // cause so the owner doesn't blame a perfectly good photo.
      setError(extractErrorMessage(status, data?.error?.code));
      setPhase("capture");
      return;
    }
    const { ok: hasItems, draft } = validateDraft(data.draft, languages);
    if (!hasItems) {
      // Request succeeded but the model found nothing orderable — this is the
      // only case where "try a clearer photo" is the right advice.
      setError(tx.errorNoItems);
      setPhase("capture");
      return;
    }
    // Capture a color theme derived from the menu's design, if any.
    const rawPalette = (data.draft as Record<string, unknown> | undefined)?.palette;
    setExtractedPreset(extractedPresetFromRaw(rawPalette, `extracted-${crypto.randomUUID()}`));
    setCats(draftToEdit(draft));
    setPhase("review");
  };

  const keptCount = cats.reduce((s, c) => (c.keep ? s + c.items.filter((i) => i.keep).length : s), 0);

  const doImport = async () => {
    if (busy || keptCount === 0) return;
    setBusy(true);
    setError(null);
    const categories = cats
      .filter((c) => c.keep)
      .map((c) => ({
        name_i18n: c.name,
        items: c.items
          .filter((it) => it.keep && hasAnyName(it.name))
          .map((it) => ({
            name_i18n: it.name,
            ...(hasAnyName(it.description) ? { description_i18n: it.description } : {}),
            price_millimes: parseMenuPrice(it.priceText) ?? 0,
            ...(it.dietary_tags?.length ? { dietary_tags: it.dietary_tags } : {}),
          })),
      }))
      .filter((c) => c.items.length > 0);
    importRefRef.current ??= crypto.randomUUID();
    const { error: rpcErr } = await getSupabase().rpc("import_menu_draft", {
      p_restaurant_id: restaurant.id,
      p_draft: { categories },
      p_import_ref: importRefRef.current,
    });
    if (rpcErr) {
      setBusy(false);
      setError(t.errors.generic);
      return;
    }
    // Best-effort: persist the theme derived from the menu photo so it appears
    // as a selectable preset in Appearance. Never fail the import over this.
    if (extractedPreset) {
      try {
        const supabase = getSupabase();
        const { data: rrow } = await supabase.from("restaurants").select("appearance").eq("id", restaurant.id).maybeSingle();
        const next = withExtractedPalette(rrow?.appearance, extractedPreset);
        await supabase.from("restaurants").update({ appearance: next }).eq("id", restaurant.id);
      } catch {
        // ignore — the menu still imported
      }
    }
    setBusy(false);
    onImported();
  };

  // ---- mutators ----
  const setCatName = (ci: number, v: string) =>
    setCats((p) => p.map((c, i) => (i === ci ? { ...c, name: { ...c.name, [editLang]: v } } : c)));
  const toggleCat = (ci: number) => setCats((p) => p.map((c, i) => (i === ci ? { ...c, keep: !c.keep } : c)));
  const addCategory = () =>
    setCats((p) => [...p, { keep: true, name: {}, items: [{ keep: true, name: {}, description: {}, priceText: "" }] }]);
  const setItem = (ci: number, ii: number, patch: Partial<EditItem>) =>
    setCats((p) =>
      p.map((c, i) => (i === ci ? { ...c, items: c.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : c)),
    );
  const removeItem = (ci: number, ii: number) =>
    setCats((p) => p.map((c, i) => (i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c)));
  const addItem = (ci: number) =>
    setCats((p) =>
      p.map((c, i) => (i === ci ? { ...c, items: [...c.items, { keep: true, name: {}, description: {}, priceText: "" }] } : c)),
    );

  const inputCls =
    "h-9 rounded-md border-[1.5px] border-line-strong bg-white px-2.5 text-[13px] font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/45 flex items-stretch sm:items-center justify-center sm:p-4 overflow-y-auto"
      onClick={() => (!busy && phase !== "extracting" ? onClose() : undefined)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-import-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[560px] bg-card sm:border border-line sm:rounded-2xl shadow-xl my-0 sm:my-8 flex flex-col min-h-dvh sm:min-h-0 sm:max-h-[calc(100dvh-4rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line shrink-0">
          <h2 id="menu-import-title" tabIndex={-1} className="font-display font-extrabold text-lg text-ink outline-none">
            {tx.title}
          </h2>
          <button
            type="button"
            aria-label={t.common.close}
            onClick={onClose}
            disabled={phase === "extracting" || busy}
            className="text-muted-soft font-extrabold text-lg cursor-pointer disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {phase === "capture" && (
          <div className="flex-1 flex flex-col gap-4 p-5">
            <p className="text-[13px] text-muted leading-relaxed">{tx.subtitle}</p>

            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
              }}
              className="border-[1.5px] border-dashed border-line-dashed rounded-xl p-6 flex flex-col items-center gap-1.5 text-center cursor-pointer hover:border-harissa transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-harissa-tint text-harissa-pressed flex items-center justify-center text-2xl" aria-hidden>
                ⊕
              </span>
              <span className="font-extrabold text-[14px] text-ink">{tx.dropTitle}</span>
              <span className="text-[12px] font-semibold text-muted-soft">{tx.dropHint}</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {photos.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">
                  {tx.pagesLabel} ({photos.length}/{MAX_PHOTOS})
                </span>
                <div className="flex gap-2 flex-wrap">
                  {photos.map((b64, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`data:image/jpeg;base64,${b64}`} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        aria-label={t.common.delete}
                        onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                        className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-ink/80 text-cream text-[11px] font-extrabold flex items-center justify-center cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-[13px] font-bold text-danger-text">{error}</p>}

            <button
              type="button"
              onClick={() => void extract()}
              disabled={photos.length === 0}
              className="mt-auto h-12 rounded-lg bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none"
            >
              {tx.extractCta.replace("{n}", String(photos.length))}
            </button>
          </div>
        )}

        {phase === "extracting" && (
          <div role="status" aria-live="polite" className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
            <Spinner className="text-harissa w-8 h-8" />
            <span className="font-extrabold text-[15px] text-ink">{tx.extracting}</span>
            <span className="text-[12.5px] text-muted-soft">{tx.extractingHint}</span>
          </div>
        )}

        {phase === "review" && (
          <>
            <div className="px-5 pt-3 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[13px] font-bold text-muted">{tx.foundSummary.replace("{n}", String(keptCount))}</span>
              {languages.length > 1 && (
                <div className="flex gap-1" dir="ltr">
                  {languages.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setEditLang(code)}
                      className={`h-7 px-2.5 rounded-sm font-bold text-[11px] cursor-pointer transition-colors ${
                        editLang === code ? "bg-ink text-cream font-extrabold" : "border-[1.5px] border-line-strong text-muted"
                      }`}
                    >
                      {code === "fr" ? "FR" : code === "ar" ? "ع" : "EN"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {extractedPreset && (
              <div className="mx-5 mt-2 flex items-center gap-2 rounded-lg bg-harissa-tint/50 px-3 py-2">
                <span aria-hidden>🎨</span>
                <span className="text-[12px] font-bold text-harissa-pressed">{t.portal.appearance.extractedThemes}</span>
                <span className="w-3.5 h-3.5 rounded-full border border-white/60" style={{ background: extractedPreset.palette.primary }} />
                <span className="w-3.5 h-3.5 rounded-full border border-white/60" style={{ background: extractedPreset.palette.accent }} />
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
              {cats.map((cat, ci) => (
                <div key={ci} className={`rounded-xl border p-3 flex flex-col gap-2 ${cat.keep ? "border-line bg-white" : "border-line bg-sand opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <input
                      dir={editLang === "ar" ? "rtl" : "ltr"}
                      aria-label={tx.categoryNameLabel}
                      placeholder={tx.categoryNameLabel}
                      className="flex-1 h-9 rounded-md bg-transparent px-1 text-[14px] font-extrabold text-ink outline-none focus:bg-white focus:border-[1.5px] focus:border-harissa"
                      value={cat.name[editLang] ?? ""}
                      onChange={(e) => setCatName(ci, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => toggleCat(ci)}
                      aria-label={tx.keepCategory}
                      className={`text-[11px] font-extrabold rounded-full px-2.5 py-1 cursor-pointer shrink-0 ${
                        cat.keep ? "bg-harissa-tint text-harissa-pressed" : "bg-sand-deep text-muted-soft"
                      }`}
                    >
                      {cat.keep ? "✓" : "—"}
                    </button>
                  </div>

                  {cat.keep &&
                    cat.items.map((it, ii) => {
                      const noPrice = it.priceText.trim() === "";
                      return (
                        <div key={ii} className={`flex items-center gap-1.5 ${it.keep ? "" : "opacity-45"}`}>
                          <input
                            type="checkbox"
                            checked={it.keep}
                            aria-label={tx.itemNameLabel}
                            onChange={(e) => setItem(ci, ii, { keep: e.target.checked })}
                            className="w-4 h-4 accent-harissa shrink-0"
                          />
                          <input
                            dir={editLang === "ar" ? "rtl" : "ltr"}
                            aria-label={tx.itemNameLabel}
                            placeholder={tx.itemNameLabel}
                            className={`${inputCls} flex-1 min-w-0`}
                            value={it.name[editLang] ?? ""}
                            onChange={(e) => setItem(ci, ii, { name: { ...it.name, [editLang]: e.target.value } })}
                          />
                          <input
                            dir="ltr"
                            inputMode="decimal"
                            aria-label={tx.priceLabel}
                            placeholder={tx.pricePlaceholder}
                            className={`h-9 w-[74px] shrink-0 rounded-md border-[1.5px] bg-white px-2 text-[13px] font-bold text-ink text-center outline-none transition-colors focus:border-harissa ${
                              noPrice ? "border-warning-border" : "border-line-strong"
                            }`}
                            value={it.priceText}
                            onChange={(e) => setItem(ci, ii, { priceText: e.target.value })}
                          />
                          <button
                            type="button"
                            aria-label={t.common.delete}
                            onClick={() => removeItem(ci, ii)}
                            className="text-muted-soft hover:text-danger font-extrabold text-xs cursor-pointer shrink-0 w-5"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}

                  {cat.keep && (
                    <button
                      type="button"
                      onClick={() => addItem(ci)}
                      className="text-[11.5px] font-extrabold text-muted-soft hover:text-harissa text-start cursor-pointer"
                    >
                      {tx.addItem}
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addCategory}
                className="border-[1.5px] border-dashed border-line-dashed rounded-lg py-2 text-muted-soft font-extrabold text-xs cursor-pointer hover:border-harissa hover:text-harissa transition-colors"
              >
                {tx.addCategory}
              </button>
            </div>

            <div className="border-t border-line px-5 py-3 flex items-center gap-2.5 shrink-0">
              {error && <p className="text-[12.5px] font-bold text-danger-text flex-1">{error}</p>}
              <button
                type="button"
                onClick={() => {
                  setCats([]);
                  setError(null);
                  setPhase("capture");
                }}
                disabled={busy}
                className={`h-11 rounded-lg border-[1.5px] border-line-strong text-ink font-extrabold text-[13.5px] px-4 cursor-pointer hover:bg-sand transition-colors disabled:opacity-60 ${error ? "" : "flex-1"}`}
              >
                {tx.retake}
              </button>
              <button
                type="button"
                onClick={() => void doImport()}
                disabled={busy || keptCount === 0}
                className="h-11 rounded-lg bg-harissa text-white font-extrabold text-[13.5px] px-4 flex-1 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none"
              >
                {busy ? <Spinner /> : tx.importCta.replace("{n}", String(keptCount))}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
