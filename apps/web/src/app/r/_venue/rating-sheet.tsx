"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SENTIMENT_EMOJI,
  sentimentToRating,
  tr as trResolve,
  type OrderItem,
  type Sentiment,
} from "@chehia/shared";
import { ensureCustomerSession, callFunction } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { FaceInput, StarInput } from "@/components/ui";

type Phase = "idle" | "sending" | "done" | "error";

/** Post-order rating: 😍/🙂/😐 for the visit + optional per-dish stars + comment. */
export function RatingSheet({
  orderId,
  lines,
  onClose,
  onSubmitted,
}: {
  orderId: string;
  lines: OrderItem[];
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { t, tr, lang } = useI18n();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const clientRef = useRef<string>("");
  if (!clientRef.current) clientRef.current = crypto.randomUUID();

  // One row per distinct dish on the order (skip deleted items).
  const dishes = useMemo(() => {
    const seen = new Map<string, OrderItem>();
    for (const l of lines) if (l.item_id && !seen.has(l.item_id)) seen.set(l.item_id, l);
    return [...seen.values()];
  }, [lines]);

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

  const hasAnything = sentiment !== null || Object.keys(itemRatings).length > 0;

  const submit = async () => {
    if (!hasAnything || phase === "sending") return;
    setPhase("sending");
    try {
      await ensureCustomerSession();
      const items = Object.entries(itemRatings).map(([item_id, rating]) => ({ item_id, rating }));
      const { ok } = await callFunction("submit-review", {
        order_id: orderId,
        venue: sentiment
          ? { rating: sentimentToRating(sentiment), sentiment, comment }
          : undefined,
        items,
        name,
        client_ref: clientRef.current,
      });
      if (!ok) throw new Error("submit failed");
      setPhase("done");
      onSubmitted?.();
      setTimeout(onClose, 2200);
    } catch {
      setPhase("error");
    }
  };

  const faceOptions = [
    { key: "love" as const, emoji: SENTIMENT_EMOJI.love, label: t.rating.faceLove },
    { key: "good" as const, emoji: SENTIMENT_EMOJI.good, label: t.rating.faceGood },
    { key: "meh" as const, emoji: SENTIMENT_EMOJI.meh, label: t.rating.faceMeh },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t.rating.visitPrompt}>
      <button aria-label={t.common.close} className="absolute inset-0 bg-ink/45 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[520px] max-h-[92dvh] bg-cream rounded-t-3xl flex flex-col overflow-hidden shadow-[0_-12px_40px_rgba(34,26,19,0.3)]">
        {phase === "done" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="w-16 h-16 rounded-full bg-success-tint flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-success text-white flex items-center justify-center font-extrabold text-lg">
                ✓
              </div>
            </div>
            <span className="font-display font-extrabold text-2xl text-ink">{t.rating.thanksTitle}</span>
            <span className="text-sm text-muted max-w-[30ch]">{t.rating.thanksBody}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <h2 className="font-display font-extrabold text-[22px] text-ink">{t.rating.visitPrompt}</h2>
              <button
                type="button"
                aria-label={t.common.close}
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white border-[1.5px] border-line flex items-center justify-center text-ink font-extrabold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-5">
              <p className="text-[13.5px] text-muted -mt-0.5">{t.rating.visitSub}</p>
              <FaceInput value={sentiment} onChange={setSentiment} options={faceOptions} />

              {dishes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-extrabold text-[15px] text-ink">{t.rating.itemsPrompt}</span>
                  <span className="text-[12.5px] text-muted-soft -mt-0.5">{t.rating.itemsSub}</span>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {dishes.map((d) => (
                      <div
                        key={d.item_id}
                        className="flex items-center justify-between gap-3 bg-card border border-line rounded-xl ps-3.5 pe-1.5 py-1.5"
                      >
                        <span className="font-bold text-[14px] text-ink flex-1 min-w-0 truncate">
                          {trResolve(d.name_snapshot, lang) || tr(d.name_snapshot)}
                        </span>
                        <StarInput
                          size={26}
                          value={itemRatings[d.item_id!] ?? 0}
                          onChange={(n) => setItemRatings((prev) => ({ ...prev, [d.item_id!]: n }))}
                          ariaLabel={tr(d.name_snapshot)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.rating.commentPlaceholder}
                maxLength={600}
                rows={2}
                className="w-full rounded-xl border-[1.5px] border-line-strong bg-white px-3.5 py-3 text-base text-ink resize-none focus:outline-none focus:border-harissa"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.rating.namePlaceholder}
                maxLength={40}
                className="w-full rounded-xl border-[1.5px] border-line-strong bg-white px-3.5 py-3 text-base text-ink focus:outline-none focus:border-harissa"
              />
              {phase === "error" && <p className="text-[13px] font-bold text-danger-text">{t.rating.error}</p>}
            </div>

            <div className="shrink-0 flex flex-col gap-1.5 px-4 py-3 bg-card border-t border-line">
              <button
                type="button"
                onClick={submit}
                disabled={!hasAnything || phase === "sending"}
                className="h-[52px] rounded-xl bg-harissa text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(188,75,38,0.3)] disabled:bg-disabled disabled:shadow-none transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {phase === "sending" ? t.rating.sending : t.rating.submit}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-10 text-muted font-bold text-[14px] cursor-pointer"
              >
                {t.rating.later}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
