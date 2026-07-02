import { fr, type Dictionary } from "./fr";
import { ar } from "./ar";
import { en } from "./en";
import type { Language } from "../types";

export type { Dictionary };
export { fr, ar, en };

export const dictionaries: Record<Language, Dictionary> = { fr, ar, en };

export function getDictionary(lang: Language): Dictionary {
  return dictionaries[lang] ?? fr;
}

/** Fill "{min}"-style placeholders: interpolate(t.order.remaining, {min: 8}). */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};
