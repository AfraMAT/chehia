"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatRating,
  formatRelativeTime,
  interpolate,
  type I18nText,
  type ReviewStatus,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Skeleton, Stars } from "@/components/ui";
import { usePortal } from "../portal-provider";

interface RecentReview {
  id: string;
  rating: number;
  sentiment: string | null;
  comment: string;
  name: string | null;
  created_at: string;
  status: ReviewStatus;
  item_id: string | null;
}
interface RatingsSummary {
  rating_avg: number | null;
  rating_count: number;
  pending_count: number;
  distribution: { rating: number; n: number }[];
  per_item: { item_id: string; name: I18nText; rating_avg: number | null; rating_count: number }[];
  recent: RecentReview[];
}

/** Business ratings dashboard: average, distribution, per-dish, recent reviews. */
export default function RatingsPage() {
  const { restaurant } = usePortal();
  const { t, tr, lang } = useI18n();
  const supabase = getSupabase();

  const [data, setData] = useState<RatingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data: rpc } = await supabase.rpc("ratings_summary", { p_restaurant_id: restaurant.id });
    setData((rpc as RatingsSummary | null) ?? null);
    setLoading(false);
  }, [restaurant.id, supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hide = async (id: string) => {
    setBusyId(id);
    await supabase.from("reviews").update({ status: "hidden" }).eq("id", id);
    await reload();
    setBusyId(null);
  };

  const itemName = (id: string | null): string | null => {
    if (!id) return null;
    const found = data?.per_item.find((p) => p.item_id === id);
    return found ? tr(found.name) : null;
  };

  const total = data?.rating_count ?? 0;
  const maxN = Math.max(1, ...(data?.distribution.map((d) => d.n) ?? [1]));

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="flex items-center gap-3 px-6 pt-5 pb-3">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.portal.ratings.title}</h1>
      </div>
      <p className="px-6 -mt-2 mb-3 text-sm text-muted">{t.portal.ratings.subtitle}</p>

      {loading ? (
        <div className="px-6 flex flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : total === 0 && (data?.pending_count ?? 0) === 0 ? (
        <div className="mx-6 bg-card border border-line rounded-2xl p-8 flex flex-col items-center gap-2 text-center">
          <span className="font-display font-extrabold text-xl text-ink">{t.portal.ratings.noReviews}</span>
          <span className="text-sm text-muted">{t.portal.ratings.noReviewsBody}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-6 pb-8">
          {/* Summary + distribution */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="md:w-[240px] bg-card border border-line rounded-2xl p-5 flex flex-col items-center justify-center gap-1.5">
              <span className="font-display font-extrabold text-[46px] leading-none text-ink tabular-nums">
                {formatRating(data?.rating_avg, lang)}
              </span>
              <Stars value={data?.rating_avg} size={20} />
              <span className="text-[12.5px] font-semibold text-muted-soft mt-0.5">
                {interpolate(t.rating.ratingsCount, { count: total })}
              </span>
              {(data?.pending_count ?? 0) > 0 && (
                <span className="mt-1 text-[11.5px] font-extrabold text-warning-text bg-warning-tint rounded-full px-2.5 py-1">
                  {data?.pending_count} {t.portal.ratings.awaiting}
                </span>
              )}
            </div>
            <div className="flex-1 bg-card border border-line rounded-2xl p-5 flex flex-col gap-2 justify-center">
              <span className="font-extrabold text-sm text-ink mb-1">{t.portal.ratings.distribution}</span>
              {(data?.distribution ?? []).map((d) => (
                <div key={d.rating} className="flex items-center gap-3">
                  <span className="w-3 text-[12.5px] font-bold text-muted tabular-nums">{d.rating}</span>
                  <span className="text-[13px]" style={{ color: "#E0A63C" }}>★</span>
                  <div className="flex-1 h-2.5 rounded-full bg-sand-deep overflow-hidden">
                    <div className="h-full rounded-full bg-harissa" style={{ width: `${(d.n / maxN) * 100}%` }} />
                  </div>
                  <span className="w-8 text-end text-[12.5px] font-bold text-muted-soft tabular-nums">{d.n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-item */}
          {(data?.per_item.length ?? 0) > 0 && (
            <div className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-2.5">
              <span className="font-extrabold text-sm text-ink">{t.portal.ratings.perItem}</span>
              <div className="flex flex-col gap-2">
                {data?.per_item.map((p) => (
                  <div key={p.item_id} className="flex items-center justify-between gap-3">
                    <span className="font-bold text-[14px] text-ink flex-1 min-w-0 truncate">{tr(p.name)}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Stars value={p.rating_avg} size={14} />
                      <span className="text-[13px] font-bold text-ink tabular-nums w-7 text-end">{formatRating(p.rating_avg, lang)}</span>
                      <span className="text-[12px] text-muted-soft tabular-nums w-9 text-end">({p.rating_count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent reviews */}
          <div className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-3">
            <span className="font-extrabold text-sm text-ink">{t.portal.ratings.recent}</span>
            <div className="flex flex-col gap-2.5">
              {(data?.recent ?? []).map((rv) => {
                const dish = itemName(rv.item_id);
                return (
                  <div key={rv.id} className="border border-line rounded-xl px-4 py-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Stars value={rv.rating} size={14} />
                        <span className="text-[11.5px] font-bold text-muted-soft bg-sand rounded-full px-2 py-0.5">
                          {dish ?? t.portal.ratings.visitReview}
                        </span>
                        {rv.status === "pending" && (
                          <span className="text-[10.5px] font-extrabold text-warning-text bg-warning-tint rounded-full px-2 py-0.5">
                            {t.portal.ratings.awaiting}
                          </span>
                        )}
                        {rv.status === "hidden" && (
                          <span className="text-[10.5px] font-extrabold text-muted-soft bg-sand-deep rounded-full px-2 py-0.5">
                            {t.portal.ratings.hidden}
                          </span>
                        )}
                      </div>
                      <span className="text-[11.5px] font-semibold text-muted-soft shrink-0">
                        {rv.name || t.portal.ratings.anon} · {formatRelativeTime(rv.created_at, lang)}
                      </span>
                    </div>
                    {rv.comment && <p className="text-[13.5px] text-muted leading-snug">{rv.comment}</p>}
                    {rv.status === "approved" && (
                      <button
                        type="button"
                        onClick={() => void hide(rv.id)}
                        disabled={busyId === rv.id}
                        className="self-start text-[12px] font-bold text-muted hover:text-danger-text cursor-pointer disabled:opacity-50"
                      >
                        {t.portal.ratings.hide}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
