"use client";

import { useCallback, useEffect, useState } from "react";

/** Chrome/Edge fire this before offering PWA install; we capture it to prompt on demand. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type Platform = "ios" | "android" | "windows" | "macos" | "other";
export type Browser = "safari" | "chromium" | "firefox" | "other";

export interface InstallState {
  /** False during SSR + first paint; gate all UI on this to avoid a hydration flash. */
  ready: boolean;
  platform: Platform;
  browser: Browser;
  isMobile: boolean;
  /** Already installed / launched as an app → nothing to offer. */
  isStandalone: boolean;
  /** A beforeinstallprompt was captured → one-tap programmatic install is available. */
  canPrompt: boolean;
  /** Trigger the native install prompt; resolves with the user's choice. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

function detect(): { platform: Platform; browser: Browser; isMobile: boolean } {
  if (typeof navigator === "undefined") return { platform: "other", browser: "other", isMobile: false };
  const ua = navigator.userAgent;
  const maxTouch = navigator.maxTouchPoints || 0;
  // iPadOS 13+ reports as "Macintosh"; disambiguate via touch points.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouch > 1);
  const isAndroid = /Android/.test(ua);
  const isWindows = /Windows/.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS;
  const platform: Platform = isIOS ? "ios" : isAndroid ? "android" : isWindows ? "windows" : isMac ? "macos" : "other";

  const isEdge = /Edg\//.test(ua);
  const isChromium = /Chrome\//.test(ua) || /CriOS/.test(ua) || isEdge;
  const isFirefox = /Firefox\//.test(ua) || /FxiOS/.test(ua);
  const isSafari = /Safari\//.test(ua) && !isChromium && !isFirefox;
  const browser: Browser = isSafari ? "safari" : isChromium ? "chromium" : isFirefox ? "firefox" : "other";

  const isMobile = isIOS || isAndroid || (maxTouch > 1 && !isMac);
  return { platform, browser, isMobile };
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  // iOS Safari exposes navigator.standalone instead of the display-mode media query.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

/** Client-only PWA install state: platform, whether it's installed, and a prompt trigger. */
export function useInstall(): InstallState {
  const [ready, setReady] = useState(false);
  const [env, setEnv] = useState<{ platform: Platform; browser: Browser; isMobile: boolean }>({
    platform: "other",
    browser: "other",
    isMobile: false,
  });
  const [isStandalone, setIsStandalone] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setEnv(detect());
    setIsStandalone(detectStandalone());
    setReady(true);

    const onBIP = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we present our own affordance
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!promptEvent) return "unavailable";
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    return outcome;
  }, [promptEvent]);

  return {
    ready,
    platform: env.platform,
    browser: env.browser,
    isMobile: env.isMobile,
    isStandalone,
    canPrompt: !!promptEvent,
    promptInstall,
  };
}
