/** Domain types shared between the customer app, web, and portal. */

export type Language = "fr" | "ar" | "en";

export const LANGUAGES: Language[] = ["fr", "ar", "en"];

/** {"fr": "...", "ar": "...", "en": "..."} — sparse allowed. */
export type I18nText = Partial<Record<Language, string>>;

export type OrderStatus = "new" | "preparing" | "ready" | "served" | "cancelled";
export type StaffRole = "owner" | "manager" | "waiter" | "kitchen";
export type WaiterCallReason = "bill" | "water" | "cutlery" | "other";
export type WaiterCallStatus = "open" | "acknowledged";

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline_i18n: I18nText;
  address: string;
  city: string;
  phone: string;
  languages: Language[];
  default_language: Language;
  timezone: string;
  logo_url: string | null;
  cover_url: string | null;
  currency: string;
  is_active: boolean;
  opening_hours: Record<string, string>;
  plan: "starter" | "pro";
  onboarding_completed_at: string | null;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name_i18n: I18nText;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name_i18n: I18nText;
  description_i18n: I18nText;
  price_millimes: number;
  photo_url: string | null;
  is_available: boolean;
  is_popular: boolean;
  allergens: string[];
  dietary_tags: string[];
  sort_order: number;
}

export interface ModifierGroup {
  id: string;
  item_id: string;
  name_i18n: I18nText;
  min_select: number;
  max_select: number;
  sort_order: number;
  modifiers: Modifier[];
}

export interface Modifier {
  id: string;
  group_id: string;
  name_i18n: I18nText;
  price_delta_millimes: number;
  is_available: boolean;
  sort_order: number;
}

export interface Table {
  id: string;
  restaurant_id: string;
  label: string;
  zone: string;
  qr_token: string;
  is_active: boolean;
  sort_order: number;
}

export interface ModifierSnapshot {
  group: I18nText;
  choice: I18nText;
  delta: number;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string;
  order_number: string;
  status: OrderStatus;
  note: string;
  language: string;
  total_millimes: number;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  name_snapshot: I18nText;
  qty: number;
  unit_price_millimes: number;
  modifiers_snapshot: ModifierSnapshot[];
  note: string;
}

export interface WaiterCall {
  id: string;
  restaurant_id: string;
  table_id: string;
  reason: WaiterCallReason;
  note: string;
  status: WaiterCallStatus;
  created_at: string;
  acknowledged_at: string | null;
}

export interface AiInsight {
  id: string;
  restaurant_id: string;
  generated_for: string;
  language: string;
  title: string;
  body: string;
  recommendation: string;
  action_label: string;
  metrics: Record<string, unknown>;
}

/** Resolve an i18n text for a language with sensible fallback chain. */
export function tr(text: I18nText | null | undefined, lang: Language): string {
  if (!text) return "";
  return text[lang] ?? text.fr ?? text.en ?? text.ar ?? "";
}

/** True when a language renders right-to-left. */
export function isRtl(lang: Language): boolean {
  return lang === "ar";
}
