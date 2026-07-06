"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildLine,
  currencyLabel,
  formatDelta,
  formatRating,
  formatRelativeTime,
  interpolate,
  millimesToDisplay,
  validateModifiers,
  type ItemReviews,
  type MenuItem,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPlaceholder, Stars, Stepper, Tag } from "@/components/ui";
import { useVenue } from "./venue-provider";

/** P3 · Item detail — required vs optional modifier groups, live price in CTA, allergens declared. */
export function ItemSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { groupsByItem, addToCart } = useVenue();
  const { t, tr, lang } = useI18n();
  const groups = useMemo(
    () => [...(groupsByItem[item.id] ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [groupsByItem, item.id],
  );

  const [selected, setSelected] = useState<string[]>(() =>
    // Preselect the first option of single-choice required groups.
    groups.filter((g) => g.min_select >= 1 && g.max_select === 1 && g.modifiers[0]).map((g) => g.modifiers[0]!.id),
  );
  const [qty, setQty] = useState(1);
  const [touched, setTouched] = useState(false);
  const [reviews, setReviews] = useState<ItemReviews | null>(null);

  // Lazy-load this dish's reviews when the sheet opens (only if it has any).
  useEffect(() => {
    if (!item.rating_count) return;
    let cancelled = false;
    void getSupabase()
      .rpc("item_reviews", { p_item_id: item.id })
      .then(({ data }) => {
        if (!cancelled && data) setReviews(data as ItemReviews);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.rating_count]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const validation = validateModifiers(groups, selected);
  const line = buildLine(item, groups, selected, qty);
  const totalLabel = `${millimesToDisplay(line.unitPriceMillimes * qty, lang)} ${currencyLabel(lang)}`;

  const toggleModifier = (groupId: string, modId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelected((prev) => {
      const inGroup = group.modifiers.map((m) => m.id);
      if (group.max_select === 1) {
        // radio behavior
        const cleared = prev.filter((id) => !inGroup.includes(id));
        return prev.includes(modId) && group.min_select === 0 ? cleared : [...cleared, modId];
      }
      if (prev.includes(modId)) return prev.filter((id) => id !== modId);
      const countInGroup = prev.filter((id) => inGroup.includes(id)).length;
      if (countInGroup >= group.max_select) return prev;
      return [...prev, modId];
    });
  };

  const submit = () => {
    setTouched(true);
    if (!validation.ok) return;
    addToCart(buildLine(item, groups, selected, qty));
    onClose();
  };

  const allergenLabels = item.allergens
    .map((a) => (t.allergens as Record<string, string>)[a] ?? a)
    .join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label={t.common.close} className="absolute inset-0 bg-ink/45 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[520px] max-h-[92dvh] bg-cream rounded-t-3xl flex flex-col overflow-hidden shadow-[0_-12px_40px_rgba(34,26,19,0.3)]">
        {/* Photo */}
        <div className="relative h-[180px] shrink-0">
          <PhotoPlaceholder src={item.photo_url} alt="" className="absolute inset-0 w-full h-full" />
          <button
            type="button"
            aria-label={t.common.close}
            onClick={onClose}
            className="absolute top-3.5 start-4 w-10 h-10 rounded-full bg-ink/80 text-cream text-lg font-extrabold flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4 flex flex-col gap-4">
          {/* Title + price */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-baseline gap-2.5">
              <h2 className="font-display font-extrabold text-[26px] leading-tight text-ink">{tr(item.name_i18n)}</h2>
              <span className="font-display font-extrabold text-[22px] text-ink whitespace-nowrap" dir="ltr">
                {millimesToDisplay(item.price_millimes, lang)}{" "}
                <span className="font-sans font-bold text-xs text-muted-soft">{currencyLabel(lang)}</span>
              </span>
            </div>
            <p className="text-[13.5px] text-muted leading-relaxed">{tr(item.description_i18n)}</p>
            {(item.rating_count ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Stars value={item.rating_avg} size={15} />
                <span className="text-[13px] font-bold text-ink tabular-nums">{formatRating(item.rating_avg, lang)}</span>
                <span className="text-[12.5px] text-muted-soft">
                  · {interpolate(t.rating.ratingsCount, { count: item.rating_count ?? 0 })}
                </span>
              </div>
            )}
            <div className="flex gap-1.5 mt-0.5 flex-wrap">
              {item.dietary_tags.includes("vegetarian") && <Tag tone="green">{t.dietary.vegetarian}</Tag>}
              {item.dietary_tags.includes("spicy") && <Tag tone="amber">{t.dietary.spicy}</Tag>}
              {allergenLabels && (
                <Tag tone="neutral">
                  {t.item.allergens} : {allergenLabels}
                </Tag>
              )}
            </div>
          </div>

          {/* Modifier groups */}
          {groups.map((group) => {
            const isRequired = group.min_select >= 1;
            const isMissing = touched && validation.missingGroups.includes(group.id);
            const multi = group.max_select > 1;
            return (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-extrabold text-sm text-ink">
                    {tr(group.name_i18n)}
                    {!isRequired && <span className="font-semibold text-xs text-muted-soft"> · {t.common.optional}</span>}
                  </span>
                  {isRequired && (
                    <span
                      className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${
                        isMissing ? "bg-danger-tint text-danger-text" : "bg-harissa-tint text-harissa-pressed"
                      }`}
                    >
                      {t.common.required}
                    </span>
                  )}
                </div>

                {multi ? (
                  <div className="flex flex-col gap-1.5">
                    {group.modifiers.map((mod) => {
                      const active = selected.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => toggleModifier(group.id, mod.id)}
                          className={`flex items-center gap-3 rounded-lg px-3.5 py-3 border-[1.5px] text-start cursor-pointer transition-colors ${
                            active ? "border-harissa bg-harissa-tint" : "border-line-strong bg-white"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`w-[21px] h-[21px] rounded-md border-2 flex items-center justify-center text-white text-xs font-extrabold ${
                              active ? "bg-harissa border-harissa" : "border-disabled"
                            }`}
                          >
                            {active ? "✓" : ""}
                          </span>
                          <span className={`flex-1 font-bold text-[13.5px] ${active ? "text-harissa-pressed" : "text-ink"}`}>
                            {tr(mod.name_i18n)}
                          </span>
                          <span className="text-[12.5px] font-bold text-muted" dir="ltr">
                            {formatDelta(mod.price_delta_millimes, lang)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {group.modifiers.map((mod) => {
                      const active = selected.includes(mod.id);
                      const hasDelta = mod.price_delta_millimes !== 0;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => toggleModifier(group.id, mod.id)}
                          className={`${hasDelta || group.modifiers.length <= 3 ? "flex-1 min-w-[72px] h-[52px] rounded-lg flex-col" : "h-[38px] px-4 rounded-full"} inline-flex items-center justify-center cursor-pointer transition-colors border-[1.5px] ${
                            active
                              ? hasDelta || group.modifiers.length <= 3
                                ? "border-2 border-harissa bg-harissa-tint"
                                : "bg-ink border-ink"
                              : "border-line-strong bg-white"
                          }`}
                        >
                          <span
                            className={`font-extrabold text-sm ${
                              active
                                ? hasDelta || group.modifiers.length <= 3
                                  ? "text-harissa-pressed"
                                  : "text-cream"
                                : "text-ink"
                            }`}
                          >
                            {tr(mod.name_i18n)}
                          </span>
                          {hasDelta && (
                            <span className={`text-[11px] font-bold ${active ? "text-harissa-pressed" : "text-muted-soft"}`} dir="ltr">
                              {formatDelta(mod.price_delta_millimes, lang)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {touched && !validation.ok && (
            <p className="text-[13px] font-bold text-danger-text">{t.item.chooseRequired}</p>
          )}

          {reviews && reviews.reviews.length > 0 && (
            <div className="flex flex-col gap-2.5 pt-1">
              <span className="font-extrabold text-sm text-ink">{t.rating.reviewsTitle}</span>
              {reviews.reviews.slice(0, 6).map((rv, i) => (
                <div key={i} className="bg-white border border-line rounded-xl px-3.5 py-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={rv.rating} size={13} />
                    <span className="text-[11.5px] font-semibold text-muted-soft">
                      {rv.name || t.rating.anon} · {formatRelativeTime(rv.created_at, lang)}
                    </span>
                  </div>
                  {rv.comment && <p className="text-[13px] text-muted leading-snug">{rv.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: qty + add */}
        <div className="shrink-0 flex gap-3 px-4 py-3 bg-card border-t border-line">
          <Stepper value={qty} onChange={setQty} min={1} max={20} />
          <button
            type="button"
            onClick={submit}
            className="flex-1 h-[52px] rounded-xl bg-harissa text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors cursor-pointer"
          >
            {t.item.addToCart} · <span dir="ltr">{totalLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
