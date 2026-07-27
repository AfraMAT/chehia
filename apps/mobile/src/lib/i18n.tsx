import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getDictionary,
  type Dictionary,
  type I18nText,
  type Language,
  tr as trBase,
} from "@chehia/shared";

interface I18nContextValue {
  lang: Language;
  /** The customer chose this — remembered across launches. */
  setLang: (lang: Language) => void;
  /**
   * Switch the active language WITHOUT touching the saved preference, for the
   * venue clamp: a venue that doesn't publish the customer's language switches
   * the UI for the visit only. Going through setLang wrote it to AsyncStorage,
   * so browsing one Arabic-only café left the whole app in Arabic for good.
   */
  setLangEphemeral: (lang: Language) => void;
  t: Dictionary;
  isRtl: boolean;
  tr: (text: I18nText | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "chehia.lang";

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  if (code === "ar") return "ar";
  if (code === "en") return "en";
  return "fr";
}

export function I18nProvider({ children, initial }: { children: React.ReactNode; initial?: Language }) {
  const [lang, setLangState] = useState<Language>(initial ?? deviceLanguage());

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && ["fr", "ar", "en"].includes(stored)) setLangState(stored as Language);
    });
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const setLangEphemeral = useCallback((next: Language) => setLangState(next), []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      setLangEphemeral,
      t: getDictionary(lang),
      isRtl: lang === "ar",
      tr: (text) => trBase(text, lang),
    }),
    [lang, setLang, setLangEphemeral],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
