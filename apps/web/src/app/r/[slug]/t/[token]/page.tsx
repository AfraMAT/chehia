"use client";

import Link from "next/link";
import { LANGUAGE_LABELS, type Language } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { ZelligeMark, Wordmark } from "@/components/brand";
import { PhotoPlaceholder } from "@/components/ui";
import { useVenue } from "./venue-provider";

/** P1 · Scan landing — venue + table context, language up front, pay-at-counter stated immediately. */
export default function ScanLanding() {
  const { restaurant, table } = useVenue();
  const { t, tr, lang, setLang } = useI18n();

  const closingTime = (() => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const today = restaurant.opening_hours?.[days[new Date().getDay()] as string];
    return today?.split("-")[1] ?? null;
  })();

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Venue photo header */}
      <div className="relative h-[290px] shrink-0">
        <PhotoPlaceholder src={restaurant.cover_url} alt="" className="absolute inset-0 w-full h-full" />
        <div className="absolute top-4 start-4 flex items-center gap-2 bg-ink/80 rounded-full ps-2 pe-3.5 py-1.5">
          <ZelligeMark size={20} radius={6} />
          <Wordmark size={13} color="#FAF6EF" dotColor="#E08D6B" />
        </div>
      </div>

      {/* Sheet */}
      <div className="flex-1 flex flex-col bg-cream rounded-t-3xl -mt-7 px-5 pt-6 pb-5 relative">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display font-extrabold text-[28px] leading-tight text-ink">{restaurant.name}</h1>
          <p className="text-sm font-semibold text-muted">
            {tr(restaurant.tagline_i18n)}
            {closingTime ? ` · ${t.landing.openUntil} ${closingTime}` : ""}
          </p>
        </div>

        {/* Table card */}
        <div className="mt-4 bg-card border border-line rounded-xl p-4 flex items-center gap-3 shadow-[0_1px_4px_rgba(60,35,15,0.04)]">
          <div className="w-11 h-11 rounded-lg bg-harissa-tint flex items-center justify-center font-display font-extrabold text-lg text-harissa-pressed shrink-0">
            {table.label}
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[15px] text-ink">
              {t.common.table} {table.label}
              {table.zone ? ` · ${table.zone}` : ""}
            </span>
            <span className="text-[13px] text-muted">{t.landing.tableContext}</span>
          </div>
        </div>

        {/* Language switch */}
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-xs font-bold text-muted-soft tracking-wide">LANGUE · اللغة</span>
          <div className="flex gap-2" dir="ltr">
            {(restaurant.languages as Language[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`flex-1 h-11 rounded-md font-bold text-sm transition-colors cursor-pointer ${
                  lang === code
                    ? "bg-ink text-cream"
                    : "border-[1.5px] border-line-strong text-ink hover:border-ink"
                } ${code === "ar" ? "font-arabic text-[15px]" : ""}`}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-6" />

        {/* Pay-at-counter reassurance + CTA */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-[7px] h-[7px] rounded-full bg-teal shrink-0" />
          <span className="text-[13px] font-semibold text-teal-pressed">{t.landing.payAtCounter}</span>
        </div>
        <Link
          href={`/r/${restaurant.slug}/t/${table.qr_token}/menu`}
          className="h-14 rounded-xl bg-harissa text-white font-extrabold text-[17px] flex items-center justify-center shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors"
        >
          {t.landing.viewMenu}
        </Link>
      </div>
    </div>
  );
}
