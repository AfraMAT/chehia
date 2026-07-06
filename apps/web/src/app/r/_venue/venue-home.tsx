"use client";

import { useState } from "react";
import Link from "next/link";
import { LANGUAGE_LABELS, formatRating, interpolate, type Language } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { ZelligeMark, Wordmark } from "@/components/brand";
import { PhotoPlaceholder, Stars } from "@/components/ui";
import { useVenue } from "./venue-provider";
import { TablePicker } from "./table-picker";
import { ActiveOrderBanner } from "./active-order-banner";

/** P1 · Venue landing — venue + table context, language up front, pay-at-counter stated immediately. */
export function VenueHome() {
  const { restaurant, table, basePath, tables } = useVenue();
  const { t, tr, lang, setLang } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const closingTime = (() => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const today = restaurant.opening_hours?.[days[new Date().getDay()] as string];
    return today?.split("-")[1] ?? null;
  })();

  // Browse flow: a table is picked in-session. Scanned flow: table is fixed.
  const browse = Boolean(tables) && !table?.qr_token;
  // Browse venue with no tables configured: the picker would be empty, so the
  // "choose your table" affordances are disabled with a hint instead.
  const noTables = browse && (tables?.length ?? 0) === 0;

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Venue photo header */}
      <div className="relative h-[290px] shrink-0">
        <PhotoPlaceholder src={restaurant.cover_url} alt="" className="absolute inset-0 w-full h-full" />
        {browse && (
          <Link
            href="/app"
            aria-label={t.common.back}
            className="absolute top-4 end-4 w-10 h-10 rounded-full bg-ink/80 text-cream flex items-center justify-center font-extrabold text-[17px]"
          >
            <span className="rtl:rotate-180 -mt-0.5">‹</span>
          </Link>
        )}
        <div className="absolute top-4 start-4 flex items-center gap-2 bg-ink/80 rounded-full ps-2 pe-3.5 py-1.5">
          <ZelligeMark size={20} radius={6} />
          <Wordmark size={13} color="#FAF6EF" dotColor="#E08D6B" />
        </div>
      </div>

      {/* Sheet */}
      <div className="flex-1 flex flex-col bg-cream rounded-t-3xl -mt-7 px-5 pt-6 pb-5 relative">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-extrabold text-[28px] leading-tight text-ink">{restaurant.name}</h1>
          <p className="text-sm font-semibold text-muted">
            {tr(restaurant.tagline_i18n)}
            {closingTime ? ` · ${t.landing.openUntil} ${closingTime}` : ""}
          </p>
          {(restaurant.rating_count ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Stars value={restaurant.rating_avg} size={15} />
              <span className="text-[13px] font-bold text-ink tabular-nums">{formatRating(restaurant.rating_avg, lang)}</span>
              <span className="text-[12.5px] text-muted-soft">
                · {interpolate(t.rating.ratingsCount, { count: restaurant.rating_count ?? 0 })}
              </span>
            </div>
          )}
        </div>

        {/* Return to an order placed from this device */}
        <ActiveOrderBanner className="mt-4" />

        {/* Table card (scanned or already picked) — or a pick prompt (browse) */}
        {table ? (
          <div className="mt-4 bg-card border border-line rounded-xl p-4 flex items-center gap-3 shadow-[0_1px_4px_rgba(60,35,15,0.04)]">
            <div className="w-11 h-11 rounded-lg bg-harissa-tint flex items-center justify-center font-display font-extrabold text-lg text-harissa-pressed shrink-0">
              {table.label}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-extrabold text-[15px] text-ink">
                {t.common.table} {table.label}
                {table.zone ? ` · ${table.zone}` : ""}
              </span>
              <span className="text-[13px] text-muted">{t.landing.tableContext}</span>
            </div>
            {browse && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-[13px] font-bold text-harissa-pressed bg-harissa-tint rounded-full px-3 py-1.5 cursor-pointer shrink-0"
              >
                {t.landing.changeTable}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={noTables}
            className="mt-4 bg-card border-[1.5px] border-dashed border-line-dashed rounded-xl p-4 flex items-center gap-3 text-start cursor-pointer hover:border-harissa transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-line-dashed"
          >
            <div className="w-11 h-11 rounded-lg bg-teal-tint flex items-center justify-center text-teal-pressed text-xl font-extrabold shrink-0" aria-hidden>
              ⌖
            </div>
            <div className="flex flex-col flex-1">
              <span className="font-extrabold text-[15px] text-ink">{t.landing.chooseTable}</span>
              <span className="text-[13px] text-muted">{noTables ? t.landing.noTables : t.landing.chooseTableBody}</span>
            </div>
            {!noTables && <span className="text-muted-soft font-extrabold rtl:rotate-180">›</span>}
          </button>
        )}

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
                  lang === code ? "bg-ink text-cream" : "border-[1.5px] border-line-strong text-ink hover:border-ink"
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
        {browse && !table ? (
          <div className="flex flex-col gap-2">
            {noTables ? (
              <p className="text-center text-[13px] font-semibold text-muted-soft mb-1">{t.landing.noTables}</p>
            ) : null}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={noTables}
              className="h-14 rounded-xl bg-harissa text-white font-extrabold text-[17px] flex items-center justify-center shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none disabled:cursor-not-allowed"
            >
              {t.landing.chooseTable}
            </button>
            <Link
              href={`${basePath}/menu`}
              className="h-12 rounded-xl border-[1.5px] border-line-strong text-ink font-extrabold text-[15px] flex items-center justify-center bg-card hover:border-ink transition-colors"
            >
              {t.landing.justBrowsing}
            </Link>
          </div>
        ) : (
          <Link
            href={`${basePath}/menu`}
            className="h-14 rounded-xl bg-harissa text-white font-extrabold text-[17px] flex items-center justify-center shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors"
          >
            {t.landing.viewMenu}
          </Link>
        )}
      </div>

      {pickerOpen && <TablePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
