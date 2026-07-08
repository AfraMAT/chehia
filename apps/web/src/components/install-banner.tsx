"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { useInstall } from "@/components/use-install";

type Surface = "app" | "business" | "caisse";
const dismissKey = (s: Surface) => `chehia.install.${s}.dismissed`;

/**
 * Device-aware "install / add to home screen" prompt.
 *  - Chrome/Edge (Android + desktop): a one-tap Install button (native prompt).
 *  - iOS Safari: manual "Share → Add to Home Screen" instructions (no web API).
 *  - Desktop Safari / other: a short hint (Add to Dock / use Chrome).
 * Hidden when already installed (standalone) or dismissed. Copy + emphasis vary
 * per surface: customer (store "coming soon"), business (add to home / to PC),
 * caisse (prominent — it's the offline hardware-connected register).
 */
export function InstallBanner({ surface }: { surface: Surface }) {
  const { t } = useI18n();
  const { ready, platform, browser, isMobile, isStandalone, canPrompt, promptInstall } = useInstall();
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(dismissKey(surface)) === "1") setDismissed(true);
    } catch {
      /* private mode: just show it */
    }
    setChecked(true);
  }, [surface]);

  if (!ready || !checked || isStandalone || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(surface), "1");
    } catch {
      /* ignore */
    }
  };
  const install = () => void promptInstall();

  const isIOS = platform === "ios";
  const isMacSafari = platform === "macos" && browser === "safari";

  // The install affordance that fits the current device/browser.
  const action = (btnClass: string) => {
    if (canPrompt) {
      const label = surface === "caisse" ? t.install.caisse.install : surface === "business" ? t.install.business.install : t.install.app.addNow;
      return (
        <button type="button" onClick={install} className={btnClass}>
          {label}
        </button>
      );
    }
    if (isIOS) return <p className="text-[12.5px] font-semibold text-muted leading-snug">{t.install.iosHow}</p>;
    if (isMacSafari) return <p className="text-[12.5px] font-semibold text-muted leading-snug">{t.install.macSafari}</p>;
    if (browser === "chromium") return <p className="text-[12.5px] font-semibold text-muted leading-snug">{t.install.desktopChrome}</p>;
    return <p className="text-[12.5px] font-semibold text-muted leading-snug">{t.install.useChrome}</p>;
  };

  const closeBtn = (
    <button
      type="button"
      onClick={dismiss}
      aria-label={t.install.later}
      className="shrink-0 w-8 h-8 rounded-full text-muted hover:text-ink hover:bg-black/5 flex items-center justify-center cursor-pointer text-[15px] leading-none"
    >
      ✕
    </button>
  );

  // ---- Customer discovery (app.chehia.app): store "coming soon" + add-to-home ----
  if (surface === "app") {
    const soon = isIOS ? t.install.app.soonIos : platform === "android" ? t.install.app.soonAndroid : t.install.app.soon;
    return (
      <div dir="auto" className="mx-5 mt-4 rounded-2xl bg-ink text-cream flex items-center gap-3 px-4 py-3">
        <span aria-hidden className="text-[22px] shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-extrabold text-[15px] leading-tight">{t.install.app.title}</p>
          <p className="text-[12.5px] text-cream/80 leading-snug">{t.install.app.subtitle}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-cream/12 px-2.5 py-1 text-[11.5px] font-bold text-cream/90">
              <span aria-hidden>{isIOS ? "" : platform === "android" ? "▶" : "⬇"}</span>
              {soon}
            </span>
            {canPrompt && (
              <button
                type="button"
                onClick={install}
                className="rounded-lg bg-harissa text-white px-3 py-1 text-[12px] font-extrabold cursor-pointer hover:bg-harissa-pressed"
              >
                {t.install.app.addNow}
              </button>
            )}
            {!canPrompt && isIOS && <span className="text-[11.5px] text-cream/70">{t.install.iosHow}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.install.later}
          className="shrink-0 w-8 h-8 rounded-full text-cream/70 hover:text-cream hover:bg-cream/10 flex items-center justify-center cursor-pointer text-[15px] leading-none"
        >
          ✕
        </button>
      </div>
    );
  }

  // ---- Business portal: add to home (mobile) / install to PC (desktop) ----
  if (surface === "business") {
    return (
      <div dir="auto" className="flex items-center gap-3 px-4 py-2.5 bg-harissa-tint border-b border-line">
        <span aria-hidden className="text-[18px] shrink-0">{isMobile ? "📲" : "🖥️"}</span>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0">
            <p className="font-extrabold text-[13.5px] text-ink leading-tight truncate">
              {isMobile ? t.install.business.titleMobile : t.install.business.titleDesktop}
            </p>
            <p className="hidden sm:block text-[12px] text-muted leading-snug">{t.install.business.subtitle}</p>
          </div>
          <div className="mt-1 sm:mt-0 shrink-0">
            {action("rounded-lg bg-ink text-cream px-3.5 py-1.5 text-[12.5px] font-extrabold cursor-pointer hover:bg-ink/90 whitespace-nowrap")}
          </div>
        </div>
        {closeBtn}
      </div>
    );
  }

  // ---- Caisse: prominent — offline register that drives printer + drawer ----
  return (
    <div dir="auto" className="shrink-0 flex items-center gap-3 px-4 py-3 bg-harissa text-white">
      <span aria-hidden className="text-[22px] shrink-0">🧾</span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-extrabold text-[15px] leading-tight">{t.install.caisse.title}</p>
        <p className="text-[12.5px] text-white/85 leading-snug">{t.install.caisse.subtitle}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {canPrompt ? (
          <button
            type="button"
            onClick={install}
            className="rounded-lg bg-white text-harissa-pressed px-4 py-2 text-[13px] font-extrabold cursor-pointer hover:bg-cream whitespace-nowrap"
          >
            {t.install.caisse.install}
          </button>
        ) : (
          <span className="max-w-[220px] text-[11.5px] font-semibold text-white/85 leading-snug">
            {isIOS || isMacSafari ? t.install.useChrome : browser === "chromium" ? t.install.desktopChrome : t.install.useChrome}
          </span>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.install.later}
          className="shrink-0 w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/15 flex items-center justify-center cursor-pointer text-[15px] leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
