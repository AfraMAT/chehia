"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { useVenue } from "./venue-provider";

/**
 * "Return to your order" bar — shown wherever a recent order is still being
 * tracked (venue home, menu). Renders nothing when there is no active order.
 * Fixes the dead-end where placing an order then navigating away left no way
 * back to the live status screen.
 */
export function ActiveOrderBanner({ className = "" }: { className?: string }) {
  const { activeOrder, basePath } = useVenue();
  const { t } = useI18n();
  if (!activeOrder) return null;
  return (
    <Link
      href={`${basePath}/order/${activeOrder.id}`}
      className={`flex items-center gap-2.5 bg-ink text-cream rounded-xl px-4 py-2.5 shadow-[0_6px_16px_rgba(34,26,19,0.22)] ${className}`}
    >
      <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex w-full h-full rounded-full bg-harissa-soft opacity-70 animate-ch-ping" />
        <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-harissa" />
      </span>
      <span className="flex-1 font-extrabold text-[13.5px]">{t.order.inProgress}</span>
      <span className="font-extrabold text-[13px] bg-white/15 rounded-lg px-3 py-1.5 flex items-center gap-1">
        {t.order.trackOrder} <span className="rtl:rotate-180">›</span>
      </span>
    </Link>
  );
}
