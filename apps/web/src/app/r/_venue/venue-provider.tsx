"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addLine as addLineBase,
  attachTable,
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
import { storageGet, storageRemove, storageSet } from "@/lib/storage";
import { I18nProvider } from "@/components/i18n-provider";
import { SessionProvider } from "./group/session-provider";
import { useLocationGate, type LocationGate } from "./use-location-gate";

/** A table the customer is ordering to — carries qr_token only in the scanned flow. */
export type TableChoice = Pick<Table, "id" | "label" | "zone"> & { qr_token?: string };

/** A pointer back to an order this device placed, so the customer can return to it. */
export type ActiveOrder = { id: string };

// Keep the "return to your order" pointer ~4h: long enough to finish a meal,
// short enough that it doesn't surface to the next customer at the same table.
const ACTIVE_ORDER_TTL_MS = 4 * 60 * 60 * 1000;

export interface VenueBundle {
  restaurant: Restaurant;
  /** Known up-front in the scanned flow; null in the browse flow until picked. */
  table: TableChoice | null;
  categories: Category[];
  items: MenuItem[];
  groupsByItem: Record<string, ModifierGroup[]>;
  /** Tables the customer can pick from in the browse flow (no qr_token). */
  tables?: TableChoice[];
}

interface VenueContextValue extends Omit<VenueBundle, "table"> {
  /** URL prefix for this venue's screens: `/r/{slug}/t/{token}` or `/r/{slug}`. */
  basePath: string;
  table: TableChoice | null;
  /** Browse flow: choose (or change) the table. Persists into the cart. */
  setTable: (table: TableChoice) => void;
  cart: Cart;
  addToCart: (line: CartLine) => void;
  updateQty: (key: string, qty: number) => void;
  setCartNote: (note: string) => void;
  clearCart: () => void;
  /** Drop lines that no longer match the live menu; returns how many were removed. */
  reconcileNow: () => number;
  online: boolean;
  /** Most-recent order placed from this device for this venue/table (kept ~4h), or null. */
  activeOrder: ActiveOrder | null;
  /** Every still-open order placed from this device here (most recent first).
   * A meal is often several sends — each stays reachable until served/cancelled. */
  activeOrders: ActiveOrder[];
  /** Remember a just-placed order so the customer can navigate back to it. */
  rememberOrder: (id: string) => void;
  /** Forget one tracked order (called when it reaches a terminal state). */
  forgetOrder: (id: string) => void;
  /**
   * Client-side "are you at the venue?" gate for the browse flow. Shared across
   * screens so locating once on the venue home carries into the cart. When
   * `locationGate.applies` is false there is no gate (scanned flow, no pin, or
   * require_location off).
   */
  locationGate: LocationGate;
}

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider({
  bundle,
  basePath,
  children,
}: {
  bundle: VenueBundle;
  basePath: string;
  children: React.ReactNode;
}) {
  // Cart storage: keyed per-table in the scanned flow (each QR is its own cart),
  // per-venue in the browse flow (one cart while you browse, table chosen later).
  const scanned = Boolean(bundle.table?.qr_token);
  const cartKey = scanned
    ? `chehia.cart.${bundle.table!.qr_token}`
    : `chehia.cart.v.${bundle.restaurant.slug}`;
  // Active-order pointer keyed like the cart (per-QR when scanned, per-venue in browse).
  const orderKey = scanned
    ? `chehia.order.${bundle.table!.qr_token}`
    : `chehia.order.v.${bundle.restaurant.slug}`;

  const [table, setTableState] = useState<TableChoice | null>(bundle.table);
  const [cart, setCart] = useState<Cart>(() => {
    const base = emptyCart(bundle.restaurant.id, bundle.table?.qr_token ?? "");
    return bundle.table && !bundle.table.qr_token ? attachTable(base, bundle.table.id) : base;
  });
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState(bundle.items);
  const [online, setOnline] = useState(true);
  const [activeOrders, setActiveOrders] = useState<{ id: string; at: number }[]>([]);

  // Hydrate the cart from localStorage, reconciling stale lines/prices against
  // the freshly loaded menu. Also restores a table picked earlier (browse flow).
  const hydrateOnceRef = useRef(false);
  useEffect(() => {
    if (hydrateOnceRef.current) return;
    hydrateOnceRef.current = true;
    try {
      const stored = storageGet(cartKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Cart;
        const sameVenue = parsed.restaurantId === bundle.restaurant.id;
        const sameTarget = scanned ? parsed.qrToken === bundle.table!.qr_token : true;
        if (sameVenue && sameTarget && Array.isArray(parsed.lines)) {
          let restored = reconcileCart(parsed, bundle.items, bundle.groupsByItem).cart;
          // Browse flow: restore a previously picked table, but only if it is
          // still available. If it was deactivated/removed, drop the stale
          // tableId so the picker reappears and `table` / cartHasTable stay in
          // sync (otherwise the cart would submit against a phantom table).
          if (!bundle.table && restored.tableId) {
            const found = bundle.tables?.find((t) => t.id === restored.tableId);
            if (found) setTableState(found);
            else restored = { ...restored, tableId: undefined };
          }
          setCart(restored);
        }
      }
    } catch {
      // corrupted cart: start fresh
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  useEffect(() => {
    if (hydrated) storageSet(cartKey, JSON.stringify(cart));
  }, [cart, cartKey, hydrated]);

  // Restore recent active orders so "return to your order" survives navigation,
  // refresh, and re-scanning the same QR. Stale entries (past the TTL) are dropped.
  // Storage is a list — a meal is often several sends and each order must stay
  // reachable — but a legacy single `{id, at}` pointer still hydrates.
  useEffect(() => {
    try {
      const raw = storageGet(orderKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { id?: string; at?: number; orders?: { id: string; at: number }[] };
      const entries = Array.isArray(parsed.orders)
        ? parsed.orders
        : parsed.id && typeof parsed.at === "number"
          ? [{ id: parsed.id, at: parsed.at }]
          : [];
      const fresh = entries.filter((e) => e.id && typeof e.at === "number" && Date.now() - e.at < ACTIVE_ORDER_TTL_MS);
      if (fresh.length > 0) {
        setActiveOrders(fresh);
        if (fresh.length !== entries.length) storageSet(orderKey, JSON.stringify({ orders: fresh }));
      } else {
        storageRemove(orderKey);
      }
    } catch {
      storageRemove(orderKey);
    }
  }, [orderKey]);

  const persistOrders = useCallback(
    (orders: { id: string; at: number }[]) => {
      if (orders.length > 0) storageSet(orderKey, JSON.stringify({ orders }));
      else storageRemove(orderKey);
    },
    [orderKey],
  );

  const rememberOrder = useCallback(
    (id: string) => {
      setActiveOrders((prev) => {
        // Most recent first; an idempotent re-place must not duplicate.
        const next = [{ id, at: Date.now() }, ...prev.filter((o) => o.id !== id)].slice(0, 8);
        persistOrders(next);
        return next;
      });
    },
    [persistOrders],
  );

  const forgetOrder = useCallback(
    (id: string) => {
      setActiveOrders((prev) => {
        const next = prev.filter((o) => o.id !== id);
        persistOrders(next);
        return next;
      });
    },
    [persistOrders],
  );

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

  const setTable = useCallback((next: TableChoice) => {
    setTableState(next);
    setCart((c) => (next.qr_token ? c : attachTable(c, next.id)));
  }, []);

  const addToCart = useCallback((line: CartLine) => setCart((c) => addLineBase(c, line)), []);
  const updateQty = useCallback((key: string, qty: number) => setCart((c) => setQtyBase(c, key, qty)), []);
  const setCartNote = useCallback((note: string) => setCart((c) => ({ ...c, note })), []);
  const clearCart = useCallback(() => {
    setCart(() => {
      const base = emptyCart(bundle.restaurant.id, table?.qr_token ?? "");
      return table && !table.qr_token ? attachTable(base, table.id) : base;
    });
  }, [bundle.restaurant.id, table]);

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

  const locationGate = useLocationGate(bundle.restaurant, table);

  const value = useMemo<VenueContextValue>(
    () => ({
      restaurant: bundle.restaurant,
      categories: bundle.categories,
      groupsByItem: bundle.groupsByItem,
      tables: bundle.tables,
      basePath,
      table,
      setTable,
      items,
      cart,
      addToCart,
      updateQty,
      setCartNote,
      clearCart,
      reconcileNow,
      online,
      activeOrder: activeOrders.length > 0 ? { id: activeOrders[0]!.id } : null,
      activeOrders: activeOrders.map(({ id }) => ({ id })),
      rememberOrder,
      forgetOrder,
      locationGate,
    }),
    [bundle, basePath, table, setTable, items, cart, addToCart, updateQty, setCartNote, clearCart, reconcileNow, online, activeOrders, rememberOrder, forgetOrder, locationGate],
  );

  return (
    <I18nProvider
      initial={bundle.restaurant.default_language as Language}
      storageKey={`chehia.lang.${bundle.restaurant.slug}`}
    >
      <VenueContext.Provider value={value}>
        <SessionProvider>{children}</SessionProvider>
      </VenueContext.Provider>
    </I18nProvider>
  );
}

export function useVenue(): VenueContextValue {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error("useVenue must be used inside VenueProvider");
  return ctx;
}
