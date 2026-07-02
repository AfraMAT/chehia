"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addLine as addLineBase,
  emptyCart,
  reconcileCart,
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
import { storageGet, storageSet } from "@/lib/storage";
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
  /** Drop lines that no longer match the live menu; returns how many were removed. */
  reconcileNow: () => number;
  online: boolean;
}

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider({ bundle, children }: { bundle: VenueBundle; children: React.ReactNode }) {
  const cartKey = `chehia.cart.${bundle.table.qr_token}`;
  const [cart, setCart] = useState<Cart>(() => emptyCart(bundle.restaurant.id, bundle.table.qr_token));
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState(bundle.items);
  const [online, setOnline] = useState(true);

  // Hydrate the cart from localStorage, reconciling stale lines/prices
  // against the freshly loaded menu. Runs once.
  const hydrateOnceRef = useRef(false);
  useEffect(() => {
    if (hydrateOnceRef.current) return;
    hydrateOnceRef.current = true;
    try {
      const stored = storageGet(cartKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Cart;
        if (parsed.qrToken === bundle.table.qr_token && Array.isArray(parsed.lines)) {
          setCart(reconcileCart(parsed, bundle.items, bundle.groupsByItem).cart);
        }
      }
    } catch {
      // corrupted cart: start fresh
    }
    setHydrated(true);
  }, [cartKey, bundle.table.qr_token, bundle.items, bundle.groupsByItem]);

  useEffect(() => {
    if (hydrated) storageSet(cartKey, JSON.stringify(cart));
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

  // Live menu: 86'd items update instantly; added/removed items too.
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`items-${bundle.restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `restaurant_id=eq.${bundle.restaurant.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removed = payload.old as Partial<MenuItem>;
            setItems((prev) => prev.filter((i) => i.id !== removed.id));
            return;
          }
          const next = payload.new as MenuItem;
          setItems((prev) =>
            prev.some((i) => i.id === next.id)
              ? prev.map((i) => (i.id === next.id ? { ...i, ...next } : i))
              : [...prev, next],
          );
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

  const itemsRef = useRef(items);
  const cartRef = useRef(cart);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);
  const reconcileNow = useCallback((): number => {
    const { cart: next, dropped } = reconcileCart(cartRef.current, itemsRef.current, bundle.groupsByItem);
    if (dropped > 0) setCart(next);
    return dropped;
  }, [bundle.groupsByItem]);

  const value = useMemo<VenueContextValue>(
    () => ({ ...bundle, items, cart, addToCart, updateQty, setCartNote, clearCart, reconcileNow, online }),
    [bundle, items, cart, addToCart, updateQty, setCartNote, clearCart, reconcileNow, online],
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
