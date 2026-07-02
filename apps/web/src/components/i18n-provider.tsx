"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getDictionary,
  isRtl,
  type Dictionary,
  type I18nText,
  type Language,
  tr as trBase,
} from "@chehia/shared";

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Dictionary;
  dir: "ltr" | "rtl";
  tr: (text: I18nText | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "chehia.lang";

export function I18nProvider({
  children,
  initial = "fr",
  storageKey = STORAGE_KEY,
}: {
  children: React.ReactNode;
  initial?: Language;
  storageKey?: string;
}) {
  const [lang, setLangState] = useState<Language>(initial);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey) as Language | null;
    if (stored && ["fr", "ar", "en"].includes(stored)) setLangState(stored);
  }, [storageKey]);

  const setLang = useCallback(
    (next: Language) => {
      setLangState(next);
      window.localStorage.setItem(storageKey, next);
    },
    [storageKey],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: getDictionary(lang),
      dir: isRtl(lang) ? "rtl" : "ltr",
      tr: (text) => trBase(text, lang),
    }),
    [lang, setLang],
  );

  return (
    <I18nContext.Provider value={value}>
      <div dir={value.dir} className="contents">
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
