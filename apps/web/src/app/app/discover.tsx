"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  formatDistanceKm,
  haversineKm,
  interpolate,
  LANGUAGE_LABELS,
  LANGUAGES,
  type Coords,
  type DiscoveryVenue,
  type Language,
} from "@chehia/shared";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { Logo, ZelligeMark } from "@/components/brand";
import { PhotoPlaceholder, SearchIcon } from "@/components/ui";

/** Consumer discovery — find a venue by name or near you, then browse & order. */
export function Discover({ venues }: { venues: DiscoveryVenue[] }) {
  return (
    <I18nProvider storageKey="chehia.lang">
      <DiscoverInner venues={venues} />
    </I18nProvider>
  );
}

type GeoState = "idle" | "locating" | "on" | "denied";

function DiscoverInner({ venues }: { venues: DiscoveryVenue[] }) {
  const { t, tr, lang, setLang } = useI18n();
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("denied");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeo("on");
      },
      () => setGeo("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withDist = venues.map((v) => {
      const dist =
        coords && v.latitude != null && v.longitude != null
          ? haversineKm(coords, { latitude: v.latitude, longitude: v.longitude })
          : null;
      return { venue: v, dist };
    });
    const filtered = q
      ? withDist.filter(({ venue }) =>
          [venue.name, venue.city, venue.address, tr(venue.tagline_i18n)].some((s) => s?.toLowerCase().includes(q)),
        )
      : withDist;
    filtered.sort((a, b) => {
      if (a.dist != null && b.dist != null) return a.dist - b.dist;
      if (a.dist != null) return -1;
      if (b.dist != null) return 1;
      return a.venue.name.localeCompare(b.venue.name);
    });
    return filtered;
  }, [venues, search, coords, tr]);

  const sortedByDistance = coords && geo === "on";

  return (
    <div className="mx-auto w-full max-w-[560px] min-h-dvh bg-cream flex flex-col">
      {/* Header */}
      <header className="px-5 pt-5 pb-2 flex items-center justify-between gap-3">
        <Logo markSize={30} textSize={20} />
        <div className="flex items-center gap-1" dir="ltr">
          {LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code as Language)}
              className={`px-2 h-8 rounded-md text-[12px] font-bold transition-colors cursor-pointer ${
                lang === code ? "bg-ink text-cream" : "text-muted hover:text-ink"
              } ${code === "ar" ? "font-arabic text-[13px]" : ""}`}
              aria-label={LANGUAGE_LABELS[code as Language]}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Title */}
      <div className="px-5 pt-3 flex flex-col gap-1">
        <h1 className="font-display font-extrabold text-[27px] leading-tight text-ink">{t.discover.title}</h1>
        <p className="text-sm font-semibold text-muted">{t.discover.subtitle}</p>
      </div>

      {/* Search + near me */}
      <div className="px-5 pt-4 flex gap-2">
        <div className="flex-1 h-[46px] rounded-lg bg-white border-[1.5px] border-line flex items-center gap-2.5 px-3.5 focus-within:border-harissa transition-colors">
          <SearchIcon className="text-muted-soft shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.discover.searchPlaceholder}
            aria-label={t.discover.searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted-soft outline-none min-w-0"
          />
        </div>
        <button
          type="button"
          onClick={locate}
          disabled={geo === "locating"}
          className={`shrink-0 h-[46px] px-3.5 rounded-lg font-bold text-[13px] flex items-center gap-1.5 transition-colors cursor-pointer ${
            sortedByDistance ? "bg-teal text-white" : "bg-white border-[1.5px] border-line-strong text-ink hover:border-teal"
          } disabled:opacity-60`}
        >
          <span aria-hidden className="text-[15px]">⌖</span>
          <span className="hidden sm:inline">{geo === "locating" ? t.discover.locating : t.discover.nearMe}</span>
        </button>
      </div>

      {geo === "denied" && (
        <p className="px-5 pt-2 text-[12.5px] font-semibold text-muted-soft">{t.discover.locationOff}</p>
      )}

      {/* Section label */}
      {results.length > 0 && (
        <p className="px-5 pt-4 pb-1 text-xs font-bold text-muted-soft tracking-wide uppercase">
          {sortedByDistance ? t.discover.nearbyLabel : t.discover.allLabel}
        </p>
      )}

      {/* List */}
      <main className="flex-1 px-5 pt-1 pb-6 flex flex-col gap-2.5">
        {venues.length === 0 ? (
          <EmptyState title={t.discover.empty} body={t.discover.emptyBody} />
        ) : results.length === 0 ? (
          <EmptyState title={t.discover.noResults} body={t.discover.noResultsBody} />
        ) : (
          results.map(({ venue, dist }) => (
            <Link
              key={venue.id}
              href={`/r/${venue.slug}`}
              className="bg-white border border-line rounded-2xl overflow-hidden flex items-stretch gap-0 hover:shadow-md transition-shadow"
            >
              <PhotoPlaceholder src={venue.cover_url} alt={venue.name} className="w-[104px] shrink-0 object-cover self-stretch" />
              <div className="flex-1 min-w-0 p-3.5 flex flex-col gap-1 justify-center">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display font-extrabold text-[17px] text-ink leading-tight truncate">
                    {venue.name}
                  </span>
                  {venue.plan === "pro" && (
                    <span className="shrink-0 text-[10px] font-extrabold text-harissa-pressed bg-harissa-tint rounded-full px-2 py-0.5">
                      PRO
                    </span>
                  )}
                </div>
                <span className="text-[12.5px] text-muted leading-snug line-clamp-1">{tr(venue.tagline_i18n)}</span>
                <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-soft">
                  <span className="truncate">{venue.city}</span>
                  {dist != null && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-teal-pressed whitespace-nowrap">
                        {interpolate(t.discover.away, { d: formatDistanceKm(dist, lang) })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </main>

      {/* Footer */}
      <footer className="px-5 pb-6 pt-2 flex flex-col items-center gap-3 border-t border-line">
        <div className="flex items-center gap-2 pt-4 text-center">
          <ZelligeMark size={16} radius={5} />
          <span className="text-[12px] font-semibold text-muted-soft">{t.discover.scanInstead}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/business" className="text-[12px] font-bold text-muted hover:text-ink transition-colors">
            {t.home.forBusinessesCta}
          </Link>
          <Link href="/legal/privacy" className="text-[12px] font-bold text-muted hover:text-ink transition-colors">
            {t.home.privacy}
          </Link>
          <Link href="/legal/terms" className="text-[12px] font-bold text-muted hover:text-ink transition-colors">
            {t.home.terms}
          </Link>
        </div>
        <span className="text-[11px] text-muted-soft">
          {t.home.builtBy}{" "}
          <a
            href="https://aframat.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-muted hover:text-ink transition-colors"
          >
            AfraMAT
          </a>
          {" · © 2026 Chehia"}
        </span>
      </footer>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <ZelligeMark size={40} />
      <span className="font-display font-extrabold text-xl text-ink mt-2">{title}</span>
      <span className="text-sm text-muted max-w-[280px]">{body}</span>
    </div>
  );
}
