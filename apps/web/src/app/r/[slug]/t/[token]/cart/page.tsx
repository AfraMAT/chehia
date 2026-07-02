"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  cartCount,
  cartTotal,
  currencyLabel,
  millimesToDisplay,
  toOrderPayload,
} from "@chehia/shared";
import { ensureCustomerSession, functionsUrl, getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Stepper } from "@/components/ui";
import { useVenue } from "../venue-provider";
import { OfflineBanner } from "../offline-banner";

/** P4 · Cart — table context re-confirmed, kitchen note, pay-at-counter stated twice. */
export default function CartPage() {
  const { restaurant, table, cart, updateQty, setCartNote, clearCart, online } = useVenue();
  const { t, tr, lang } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = cartCount(cart);
  const total = cartTotal(cart);
  const base = `/r/${restaurant.slug}/t/${table.qr_token}`;

  const submit = async () => {
    if (submitting || cart.lines.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await ensureCustomerSession();
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(functionsUrl("place-order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify(toOrderPayload(cart, lang)),
      });
      const json = await response.json();
      if (!response.ok) {
        const code = json?.error?.code as string | undefined;
        if (code === "item_unavailable" || code === "unknown_item") {
          setError(t.cart.itemUnavailable);
        } else if (code === "unknown_table") {
          setError(t.errors.unknownTable);
        } else {
          setError(t.errors.orderFailed);
        }
        return;
      }
      clearCart();
      router.push(`${base}/order/${json.order.id}`);
    } catch {
      // Network failure: keep the cart, let the user retry (P8 behavior).
      setQueued(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (count === 0 && !submitting) {
    return (
      <div className="flex flex-col min-h-dvh">
        <Header title={t.cart.title} backHref={`${base}/menu`} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="font-display font-extrabold text-2xl text-ink">{t.cart.empty}</span>
          <span className="text-sm text-muted">{t.cart.emptyBody}</span>
          <Link
            href={`${base}/menu`}
            className="mt-3 h-12 px-6 rounded-xl bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center shadow-[0_4px_12px_rgba(188,75,38,0.25)]"
          >
            {t.cart.browseMenu}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <OfflineBanner />
      <Header title={t.cart.title} backHref={`${base}/menu`} />

      {/* Table context */}
      <div className="mx-5 mt-3.5 bg-teal-tint rounded-lg px-4 py-3 flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-teal shrink-0" />
        <span className="text-[13px] font-bold text-teal-pressed">
          {t.common.table} {table.label}
          {table.zone ? ` · ${table.zone}` : ""} — {restaurant.name}
        </span>
      </div>

      {/* Queued order (offline) */}
      {queued && (
        <div className="mx-4 mt-3 bg-ink rounded-2xl p-4 flex flex-col gap-3 shadow-[0_8px_22px_rgba(34,26,19,0.25)]">
          <div className="flex items-center gap-3">
            <span className="w-[42px] h-[42px] rounded-full bg-white/10 flex items-center justify-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-harissa-soft animate-ch-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-harissa-soft animate-ch-pulse [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-harissa-soft animate-ch-pulse [animation-delay:0.4s]" />
            </span>
            <div className="flex flex-col">
              <span className="font-extrabold text-[15px] text-cream">{t.offline.queued}</span>
              <span className="text-[12.5px] font-semibold text-cream/65">
                {count} {t.common.items} · <span dir="ltr">{millimesToDisplay(total, lang)} {currencyLabel(lang)}</span> —{" "}
                {t.offline.queuedBody}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            className="h-[42px] rounded-lg bg-harissa text-white font-extrabold text-[13.5px] cursor-pointer"
          >
            {t.offline.retryNow}
          </button>
        </div>
      )}

      {/* Lines */}
      <main className="flex-1 px-5 pt-4 flex flex-col gap-2.5">
        {cart.lines.map((line) => (
          <div key={line.key} className="bg-white border border-line rounded-xl px-3.5 py-3 flex flex-col gap-1">
            <div className="flex justify-between gap-2">
              <span className="font-extrabold text-[15px] text-ink">{tr(line.name)}</span>
              <span className="font-extrabold text-[15px] text-ink" dir="ltr">
                {millimesToDisplay(line.unitPriceMillimes * line.qty, lang)}
              </span>
            </div>
            {(line.modifierLabels.length > 0 || line.note) && (
              <span className="text-xs text-muted leading-relaxed">
                {line.modifierLabels.map((m) => tr(m.choice)).join(" · ")}
                {line.note ? `${line.modifierLabels.length ? " · " : ""}${line.note}` : ""}
              </span>
            )}
            <div className="mt-1.5">
              <Stepper size="sm" value={line.qty} onChange={(q) => updateQty(line.key, q)} />
            </div>
          </div>
        ))}

        {/* Kitchen note */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label htmlFor="kitchen-note" className="text-xs font-bold text-muted">
            {t.cart.kitchenNote}
          </label>
          <textarea
            id="kitchen-note"
            value={cart.note}
            onChange={(e) => setCartNote(e.target.value)}
            placeholder={t.cart.kitchenNotePlaceholder}
            maxLength={500}
            rows={2}
            className="rounded-lg border-[1.5px] border-line-strong bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-muted-soft outline-none focus:border-harissa transition-colors resize-none"
          />
        </div>

        {/* Totals */}
        <div className="border-t border-dashed border-line-strong mt-1.5 pt-3 flex flex-col gap-1.5 pb-4">
          <div className="flex justify-between">
            <span className="text-[13px] font-semibold text-muted">
              {t.common.subtotal} · {count} {count > 1 ? t.common.items : t.common.item}
            </span>
            <span className="text-[13px] font-bold text-ink" dir="ltr">
              {millimesToDisplay(total, lang)} {currencyLabel(lang)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="font-extrabold text-base text-ink">{t.common.total}</span>
            <span className="font-display font-extrabold text-2xl text-ink" dir="ltr">
              {millimesToDisplay(total, lang)}{" "}
              <span className="font-sans font-bold text-xs text-muted-soft">{currencyLabel(lang)}</span>
            </span>
          </div>
        </div>
      </main>

      {/* Submit */}
      <div className="sticky bottom-0 px-4 pt-2.5 pb-3.5 bg-card border-t border-line flex flex-col gap-2">
        {error && <p className="text-center text-[13px] font-bold text-danger-text">{error}</p>}
        <div className="flex items-center justify-center gap-2">
          <span className="w-[7px] h-[7px] rounded-full bg-teal shrink-0" />
          <span className="text-[12.5px] font-semibold text-teal-pressed">{t.cart.payAtCounter}</span>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !online}
          className="h-[54px] rounded-xl bg-harissa text-white font-extrabold text-[16.5px] flex items-center justify-center shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none"
        >
          {submitting ? t.cart.submitting : t.cart.submit}
        </button>
      </div>
    </div>
  );
}

function Header({ title, backHref }: { title: string; backHref: string }) {
  return (
    <header className="px-5 pt-4 flex items-center gap-3">
      <Link
        href={backHref}
        aria-label="back"
        className="w-10 h-10 rounded-full bg-white border-[1.5px] border-line flex items-center justify-center text-ink font-extrabold text-[17px]"
      >
        <span className="rtl:rotate-180 -mt-0.5">‹</span>
      </Link>
      <h1 className="font-display font-extrabold text-[22px] text-ink">{title}</h1>
    </header>
  );
}
