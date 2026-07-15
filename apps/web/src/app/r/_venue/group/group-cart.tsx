"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { currencyLabel, formatPrice, interpolate, millimesToDisplay } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { Spinner, Stepper } from "@/components/ui";
import { useVenue } from "../venue-provider";
import { useSession } from "./session-provider";

/** The shared group cart: participants, attributed lines, ready state, placement. */
export function GroupCart({ onClose }: { onClose: () => void }) {
  const { t, tr, lang } = useI18n();
  const { items, groupsByItem, basePath, rememberOrder } = useVenue();
  const {
    session,
    lines,
    activeParticipants,
    myParticipantId,
    isHost,
    amReady,
    allReady,
    setReady,
    setLineQty,
    placeGroup,
    placeSolo,
    leave,
  } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<"group" | "solo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const unitOf = (itemId: string, modifierIds: string[]): number => {
    const item = itemById.get(itemId);
    if (!item) return 0;
    let delta = 0;
    for (const g of groupsByItem[itemId] ?? []) for (const m of g.modifiers) if (modifierIds.includes(m.id)) delta += m.price_delta_millimes;
    return item.price_millimes + delta;
  };

  const myLines = lines.filter((l) => l.participant_id === myParticipantId);
  // Total only what's visible: lines owned by participants still in the session —
  // a leaver's residue must never inflate the footer (the server now deletes it
  // in leave_session; this also guards against realtime lag).
  const activeIds = new Set(activeParticipants.map((p) => p.id));
  const groupTotal = lines.filter((l) => activeIds.has(l.participant_id)).reduce((s, l) => s + unitOf(l.item_id, l.modifier_ids) * l.qty, 0);
  const myTotal = myLines.reduce((s, l) => s + unitOf(l.item_id, l.modifier_ids) * l.qty, 0);

  if (!session) return null;

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}${basePath}/menu?s=${session.share_code}` : "";

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: t.group.groupOrder, text: t.group.shareHint, url: shareLink });
        return;
      }
    } catch {
      // fall through to copy
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const doPlace = async (mode: "group" | "solo") => {
    setBusy(mode);
    setError(null);
    const res = mode === "group" ? await placeGroup() : await placeSolo();
    setBusy(null);
    if (!res.ok) {
      setError(
        res.code === "not_ready" ? t.group.errorNotReady : res.code === "host_only" ? t.group.onlyHostPlaces : res.code === "session_closed" ? t.group.sessionClosed : t.errors.generic,
      );
      return;
    }
    if (res.orderId) {
      rememberOrder(res.orderId);
      onClose();
      router.push(`${basePath}/order/${res.orderId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label={t.common.close} className="absolute inset-0 bg-ink/45 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[520px] max-h-[92dvh] bg-cream rounded-t-3xl flex flex-col overflow-hidden shadow-[0_-12px_40px_rgba(34,26,19,0.3)]">
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-line flex items-center gap-2">
          <span aria-hidden className="text-[18px]">👥</span>
          <h2 className="font-display font-extrabold text-[19px] text-ink flex-1">{t.group.groupOrder}</h2>
          <button type="button" aria-label={t.common.close} onClick={onClose} className="text-muted-soft font-extrabold text-lg cursor-pointer">✕</button>
        </div>

        {/* Share */}
        <div className="shrink-0 px-5 py-2.5 bg-teal-tint/60 flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <span className="block text-[11px] font-bold text-teal-pressed/80">{t.group.code}</span>
            <span className="font-display font-extrabold text-[18px] text-teal-pressed tracking-widest" dir="ltr">{session.share_code}</span>
          </div>
          <button type="button" onClick={() => void share()} className="h-9 px-3.5 rounded-lg bg-teal text-white font-extrabold text-[12.5px] cursor-pointer hover:bg-teal-pressed transition-colors">
            {copied ? t.group.linkCopied : t.group.shareVia}
          </button>
        </div>

        {/* Participants + their lines */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-4">
          {activeParticipants.map((p) => {
            const pLines = lines.filter((l) => l.participant_id === p.id);
            const mine = p.id === myParticipantId;
            return (
              <div key={p.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[14px] text-ink">
                    {mine ? t.group.you : p.nickname}
                    {p.is_host && <span className="ms-1.5 text-[11px] font-bold text-teal-pressed bg-teal-tint rounded-full px-2 py-0.5">{t.group.host}</span>}
                  </span>
                  <div className="flex-1" />
                  <span className={`text-[11px] font-extrabold rounded-full px-2.5 py-0.5 ${p.is_ready ? "bg-success-tint text-success-text" : "bg-sand-deep text-muted-soft"}`}>
                    {p.is_ready ? `✓ ${t.group.ready}` : t.group.waiting}
                  </span>
                </div>

                {pLines.length === 0 ? (
                  <p className="text-[12.5px] text-muted-soft ps-1">{t.group.emptyCart}</p>
                ) : (
                  pLines.map((l) => {
                    const item = itemById.get(l.item_id);
                    const unit = unitOf(l.item_id, l.modifier_ids);
                    return (
                      <div key={l.id} className="flex items-center gap-2.5 bg-card border border-line rounded-lg px-3 py-2">
                        <span className="font-bold text-[13.5px] text-ink flex-1 min-w-0 truncate">{item ? tr(item.name_i18n) : "—"}</span>
                        {mine ? (
                          <Stepper value={l.qty} onChange={(q) => void setLineQty(l.id, q)} min={0} max={20} size="sm" />
                        ) : (
                          <span className="text-[12.5px] font-bold text-muted-soft">×{l.qty}</span>
                        )}
                        <span className="font-extrabold text-[13.5px] text-ink w-16 text-end" dir="ltr">
                          {millimesToDisplay(unit * l.qty, lang)} <span className="text-[10px] text-muted-soft">{currencyLabel(lang)}</span>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-line bg-card px-5 py-3 flex flex-col gap-2.5">
          {error && <p className="text-[12.5px] font-bold text-danger-text">{error}</p>}

          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-muted">{t.common.total}</span>
            <span className="font-display font-extrabold text-[17px] text-ink" dir="ltr">{formatPrice(groupTotal, lang)}</span>
          </div>

          {/* Ready toggle */}
          <button
            type="button"
            onClick={() => void setReady(!amReady)}
            className={`h-11 rounded-xl font-extrabold text-[14px] cursor-pointer transition-colors ${amReady ? "bg-sand-deep text-muted border-[1.5px] border-line-strong" : "bg-success text-white"}`}
          >
            {amReady ? t.group.notReadyYet : t.group.imReady}
          </button>

          {/* Host placement */}
          {isHost ? (
            <button
              type="button"
              onClick={() => void doPlace("group")}
              disabled={!allReady || busy !== null}
              className="h-13 min-h-[52px] rounded-xl bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none"
            >
              {busy === "group" ? <Spinner /> : `${t.group.placeGroupOrder}`}
            </button>
          ) : (
            <p className="text-center text-[12.5px] font-semibold text-muted-soft">{allReady ? t.group.allReady : t.group.hostWillPlace}</p>
          )}

          {/* Solo split */}
          <button
            type="button"
            onClick={() => void doPlace("solo")}
            disabled={busy !== null || myLines.length === 0}
            className="h-11 rounded-xl border-[1.5px] border-line-strong text-ink font-extrabold text-[13px] flex items-center justify-center gap-2 hover:bg-sand transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy === "solo" ? <Spinner /> : `${t.group.checkoutSolo} · ${millimesToDisplay(myTotal, lang)} ${currencyLabel(lang)}`}
          </button>

          <button type="button" onClick={() => void leave().then(onClose)} className="text-center text-[12px] font-bold text-muted-soft hover:text-danger-text cursor-pointer">
            {t.group.leave}
          </button>
          <span className="sr-only">{interpolate(t.group.membersCount, { n: activeParticipants.length })}</span>
        </div>
      </div>
    </div>
  );
}
