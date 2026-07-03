"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

/**
 * Unobtrusive portal/admin footer — legal links + AfraMAT attribution.
 * Logical spacing (ps-/pe- via flex gap) keeps it RTL-correct.
 */
export function PortalFooter({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <footer
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-6 py-5 text-[11.5px] text-muted-soft no-print ${className}`}
    >
      <Link href="/legal/privacy" className="font-bold hover:text-muted transition-colors">
        {t.home.privacy}
      </Link>
      <Link href="/legal/terms" className="font-bold hover:text-muted transition-colors">
        {t.home.terms}
      </Link>
      <span>
        {t.home.builtBy}{" "}
        <a
          href="https://aframat.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-muted hover:text-ink transition-colors"
        >
          AfraMAT
        </a>
      </span>
    </footer>
  );
}
