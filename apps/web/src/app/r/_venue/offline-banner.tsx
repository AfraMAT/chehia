"use client";

import { useI18n } from "@/components/i18n-provider";
import { useVenue } from "./venue-provider";

/** P8 · Poor-connection banner — shown whenever the browser reports offline. */
export function OfflineBanner() {
  const { online } = useVenue();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div className="mx-4 mt-3 bg-warning-tint border-[1.5px] border-warning-border rounded-lg px-4 py-3 flex items-center gap-3">
      <span className="w-[9px] h-[9px] rounded-full bg-warning animate-ch-pulse shrink-0" />
      {/* No `t.offline.menuAvailable` here: that promise is mobile-only. The web
          venue routes are force-dynamic and register no service worker, so a
          reload or a route change offline lands on the error boundary. */}
      <span className="font-extrabold text-[13.5px] text-warning-text">{t.offline.unstable}</span>
    </div>
  );
}
