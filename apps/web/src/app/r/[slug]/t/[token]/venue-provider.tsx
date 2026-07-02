"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  addLine as addLineBase,
  emptyCart,
  setQty as setQtyBase,
  type Cart,
  type CartLine,
  type Category,
  type Language,
  type MenuItem,
  type ModifierGroup,
  type Restaurant,
  type Table,
} from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { I18nProvider } from "@/components/i18n-provider";

export interface VenueBundle {
  restaurant: Restaurant;
  table: Pick<Table, "id" | "label" | "zone" | "qr_token">;
  categories: Category[];
  items: MenuItem[];
  groupsByItem: Record<string, ModifierGroup[]>;
}

interface VenueContextValue extends VenueBundle {
  cart: Cart;
  addToCart: (line: CartLine) => void;
  updateQty: (key: string, qty: number) => void;
  setCartNote: (note: string) => void;
  clearCart: () => void;
  online: boolean;
}

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider({ bundle, children }: { bundle: VenueBundle; children: React.ReactNode }) {
  const cartKey = `chehia.cart.${bundle.table.qr_token}`;
  const [cart, setCart] = useState<Cart>(() => emptyCart(bundle.restaurant.id, bundle.table.qr_token));
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState(bundle.items);
  const [online, setOnline] = useState(true);

  // Hydrate the cart from localStorage.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(cartKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Cart;
        if (parsed.qrToken === bundle.table.qr_token) setCart(parsed);
      }
    } catch {
      // corrupted cart: start fresh
    }
    setHydrated(true);
  }, [cartKey, bundle.table.qr_token]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey, hydrated]);

  // Track connectivity for the offline banner + queued submissions.
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Live availability: 86'd items update instantly.
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`items-${bundle.restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items", filter: `restaurant_id=eq.${bundle.restaurant.id}` },
        (payload) => {
          const updated = payload.new as MenuItem;
          setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bundle.restaurant.id]);

  const addToCart = useCallback((line: CartLine) => setCart((c) => addLineBase(c, line)), []);
  const updateQty = useCallback((key: string, qty: number) => setCart((c) => setQtyBase(c, key, qty)), []);
  const setCartNote = useCallback((note: string) => setCart((c) => ({ ...c, note })), []);
  const clearCart = useCallback(
    () => setCart(emptyCart(bundle.restaurant.id, bundle.table.qr_token)),
    [bundle.restaurant.id, bundle.table.qr_token],
  );

  const value = useMemo<VenueContextValue>(
    () => ({ ...bundle, items, cart, addToCart, updateQty, setCartNote, clearCart, online }),
    [bundle, items, cart, addToCart, updateQty, setCartNote, clearCart, online],
  );

  return (
    <I18nProvider initial={bundle.restaurant.default_language as Language} storageKey={`chehia.lang.${bundle.restaurant.slug}`}>
      <VenueContext.Provider value={value}>{children}</VenueContext.Provider>
    </I18nProvider>
  );
}

export function useVenue(): VenueContextValue {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error("useVenue must be used inside VenueProvider");
  return ctx;
}
