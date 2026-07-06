"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatRelativeTime,
  tr as trResolve,
  type I18nText,
  type Language,
  type ReviewStatus,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Stars } from "@/components/ui";

interface ModReview {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  order_number: string;
  item_name: I18nText | null;
  rating: number;
  sentiment: string | null;
  comment: string;
  customer_name: string;
  status: ReviewStatus;
  created_at: string;
}

type Filter = "pending" | "approved" | "all";

/** Platform-admin review moderation queue — approve / reject / hide. */
export function ReviewsModeration() {
  const { t, lang } = useI18n();
  const supabase = getSupabase();
  const [reviews, setReviews] = useState<ModReview[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_reviews_moderation", {
      p_status: filter === "all" ? null : filter,
    });
    setReviews((data as ModReview[] | null) ?? []);
  }, [supabase, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: ReviewStatus) => {
    setBusyId(id);
    await supabase.from("reviews").update({ status }).eq("id", id);
    await load();
    setBusyId(null);
  };

  const approveAll = async () => {
    const pending = (reviews ?? []).filter((r) => r.status === "pending").map((r) => r.id);
    if (pending.length === 0) return;
    setBusyId("all");
    await supabase.from("reviews").update({ status: "approved" }).in("id", pending);
    await load();
    setBusyId(null);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "pending", label: t.admin.reviewsPending },
    { key: "approved", label: t.admin.reviewsApproved },
    { key: "all", label: t.admin.reviewsAll },
  ];

  const statusChip: Record<ReviewStatus, string> = {
    pending: "bg-warning-tint text-warning-text",
    approved: "bg-success-tint text-success-text",
    rejected: "bg-danger-tint text-danger-text",
    hidden: "bg-sand-deep text-muted-soft",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.admin.reviewsModeration}</h1>
        <div className="flex-1" />
        <div className="flex gap-1 bg-sand-deep rounded-md p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-8 px-3.5 rounded-sm text-[12.5px] font-extrabold cursor-pointer transition-colors ${
                filter === f.key ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter === "pending" && (reviews?.some((r) => r.status === "pending") ?? false) && (
          <button
            type="button"
            onClick={() => void approveAll()}
            disabled={busyId === "all"}
            className="h-8 px-3.5 rounded-lg bg-success text-white font-extrabold text-[12.5px] cursor-pointer disabled:opacity-50"
          >
            {t.admin.approveAll}
          </button>
        )}
      </div>

      {reviews === null ? (
        <div className="flex justify-center py-16">
          <span className="w-7 h-7 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-10 flex flex-col items-center gap-2 text-center">
          <span className="font-extrabold text-lg text-ink">{t.admin.reviewsEmpty}</span>
          <span className="text-sm text-muted">{t.admin.reviewsEmptyBody}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {reviews.map((r) => (
            <div key={r.id} className="bg-card border border-line rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Stars value={r.rating} size={15} />
                <span className="text-[12px] font-extrabold text-ink">{r.restaurant_name}</span>
                <span className="text-[11px] font-semibold text-muted-soft" dir="ltr">
                  #{r.order_number}
                </span>
                <span className="text-[10.5px] font-bold text-muted-soft bg-sand rounded-full px-2 py-0.5">
                  {r.item_name ? trResolve(r.item_name, lang as Language) : t.admin.reviewVisit}
                </span>
                <span className={`text-[10.5px] font-extrabold rounded-full px-2 py-0.5 ${statusChip[r.status]}`}>
                  {r.status === "pending"
                    ? t.admin.reviewsPending
                    : r.status === "approved"
                      ? t.admin.reviewsApproved
                      : r.status === "rejected"
                        ? t.admin.reviewsRejected
                        : t.admin.reviewsHidden}
                </span>
                <div className="flex-1" />
                <span className="text-[11px] font-semibold text-muted-soft">
                  {r.customer_name || t.admin.anon} · {formatRelativeTime(r.created_at, lang)}
                </span>
              </div>
              {r.comment && <p className="text-[13.5px] text-ink leading-snug">{r.comment}</p>}
              <div className="flex gap-2 pt-0.5">
                {r.status !== "approved" && (
                  <button
                    type="button"
                    onClick={() => void setStatus(r.id, "approved")}
                    disabled={busyId === r.id}
                    className="h-8 px-3.5 rounded-lg bg-success text-white font-extrabold text-[12.5px] cursor-pointer disabled:opacity-50"
                  >
                    {t.admin.approve}
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    type="button"
                    onClick={() => void setStatus(r.id, "rejected")}
                    disabled={busyId === r.id}
                    className="h-8 px-3.5 rounded-lg border-[1.5px] border-line-strong text-muted font-extrabold text-[12.5px] cursor-pointer hover:text-danger-text hover:border-danger disabled:opacity-50"
                  >
                    {t.admin.reject}
                  </button>
                )}
                {r.status === "approved" && (
                  <button
                    type="button"
                    onClick={() => void setStatus(r.id, "hidden")}
                    disabled={busyId === r.id}
                    className="h-8 px-3.5 rounded-lg border-[1.5px] border-line-strong text-muted font-extrabold text-[12.5px] cursor-pointer disabled:opacity-50"
                  >
                    {t.admin.hideReview}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
