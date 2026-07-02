import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addLine as addLineBase,
  emptyCart,
  reconcileCart,
  setQty as setQtyBase,
  toOrderPayload,
  type Cart,
  type CartLine,
  type Category,
  type MenuItem,
  type Modifier,
  type ModifierGroup,
  type Restaurant,
  type Table,
} from "@chehia/shared";
import { ensureCustomerSession, functionsUrl, supabase, supabaseAnonKey } from "./supabase";

export interface VenueBundle {
  restaurant: Restaurant;
  table: Pick<Table, "id" | "label" | "zone" | "qr_token">;
  categories: Category[];
  items: MenuItem[];
  groupsByItem: Record<string, ModifierGroup[]>;
}

export type VenueState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "ready"; bundle: VenueBundle; fromCache: boolean };

interface PlaceOrderResult {
  ok: boolean;
  orderId?: string;
  errorCode?: string;
  queued?: boolean;
}

/** What sits in the offline queue: the snapshot, its language, and its idempotency key. */
interface QueuedPayload {
  cart: Cart;
  language: string;
  clientRef: string;
}

/** RFC4122 v4 (Math.random based — used only as an idempotency key). */
function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface VenueContextValue {
  state: VenueState;
  cart: Cart;
  online: boolean;
  cachedAt: string | null;
  queuedOrder: { count: number; totalMillimes: number } | null;
  /** Set when a queued order was auto-submitted successfully (navigate to tracking). */
  queuedPlacedOrderId: string | null;
  addToCart: (line: CartLine) => void;
  updateQty: (key: string, qty: number) => void;
  setCartNote: (note: string) => void;
  clearCart: () => void;
  placeOrder: (language: string) => Promise<PlaceOrderResult>;
  retryQueued: (overrideLanguage?: string) => Promise<PlaceOrderResult>;
  callWaiter: (reason: string, note: string) => Promise<boolean>;
}

const VenueContext = createContext<VenueContextValue | null>(null);

const menuCacheKey = (slug: string, token: string) => `chehia.menu.${slug}.${token}`;
const cartKey = (token: string) => `chehia.cart.${token}`;
const queueKey = (token: string) => `chehia.queue.${token}`;

/**
 * Loads the venue bundle. Returns null only for a genuine "not found"
 * (bad slug/token); THROWS on network/database failures so the caller can
 * fall back to the cached menu instead of showing "invalid QR".
 */
async function fetchBundle(slug: string, token: string): Promise<VenueBundle | null> {
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<Restaurant>();
  if (restaurantError) throw new Error("network");
  if (!restaurant) return null;

  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("id, label, zone, qr_token")
    .eq("restaurant_id", restaurant.id)
    .eq("qr_token", token)
    .eq("is_active", true)
    .maybeSingle<Pick<Table, "id" | "label" | "zone" | "qr_token">>();
  if (tableError) throw new Error("network");
  if (!table) return null;

  const [{ data: categories }, { data: items }, { data: groups }, { data: modifiers }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order")
      .overrideTypes<Category[], { merge: false }>(),
    supabase
      .from("items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order")
      .overrideTypes<MenuItem[], { merge: false }>(),
    supabase
      .from("modifier_groups")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order")
      .overrideTypes<Omit<ModifierGroup, "modifiers">[], { merge: false }>(),
    supabase
      .from("modifiers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true)
      .order("sort_order")
      .overrideTypes<Modifier[], { merge: false }>(),
  ]);

  const groupsByItem: Record<string, ModifierGroup[]> = {};
  for (const group of groups ?? []) {
    (groupsByItem[group.item_id] ??= []).push({
      ...group,
      modifiers: (modifiers ?? []).filter((m) => m.group_id === group.id),
    });
  }

  return { restaurant, table, categories: categories ?? [], items: items ?? [], groupsByItem };
}

export function VenueProvider({
  slug,
  token,
  children,
}: {
  slug: string;
  token: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<VenueState>({ status: "loading" });
  const [cart, setCart] = useState<Cart>(() => emptyCart("", token));
  const [cartHydrated, setCartHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [queuedOrder, setQueuedOrder] = useState<{ count: number; totalMillimes: number } | null>(null);
  const [queuedPlacedOrderId, setQueuedPlacedOrderId] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Connectivity.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setOnline(Boolean(netState.isConnected));
    });
    return unsubscribe;
  }, []);

  // Load venue: network first, cache fallback (P8: menu stays readable offline).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bundle = await fetchBundle(slug, token);
        if (cancelled) return;
        if (!bundle) {
          setState({ status: "invalid" });
          return;
        }
        setState({ status: "ready", bundle, fromCache: false });
        setCachedAt(null);
        // Cache the full bundle (table included) keyed per slug+token.
        await AsyncStorage.setItem(
          menuCacheKey(slug, token),
          JSON.stringify({ bundle, at: new Date().toISOString() }),
        );
      } catch {
        // Network failure → cached menu.
        const raw = await AsyncStorage.getItem(menuCacheKey(slug, token));
        if (cancelled) return;
        if (raw) {
          try {
            const { bundle, at } = JSON.parse(raw) as { bundle: VenueBundle; at: string };
            setState({ status: "ready", bundle, fromCache: true });
            setCachedAt(at);
            return;
          } catch {
            // fall through
          }
        }
        setState({ status: "invalid" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  // Hydrate cart + queued order. The cart is reconciled against the live
  // menu once it arrives (stale prices/vanished items are corrected).
  useEffect(() => {
    void (async () => {
      const [rawCart, rawQueue] = await Promise.all([
        AsyncStorage.getItem(cartKey(token)),
        AsyncStorage.getItem(queueKey(token)),
      ]);
      if (rawCart) {
        try {
          const parsed = JSON.parse(rawCart) as Cart;
          if (parsed.qrToken === token && Array.isArray(parsed.lines)) setCart(parsed);
        } catch {
          // fresh cart
        }
      }
      if (rawQueue) {
        try {
          const parsed = JSON.parse(rawQueue) as QueuedPayload;
          setQueuedOrder({
            count: parsed.cart.lines.reduce((s, l) => s + l.qty, 0),
            totalMillimes: parsed.cart.lines.reduce((s, l) => s + l.unitPriceMillimes * l.qty, 0),
          });
        } catch {
          // ignore
        }
      }
      setCartHydrated(true);
    })();
  }, [token]);

  // Reconcile the hydrated cart when fresh (non-cache) menu data is ready.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (!cartHydrated || reconciledRef.current) return;
    if (state.status !== "ready" || state.fromCache) return;
    reconciledRef.current = true;
    setCart((c) => reconcileCart(c, state.bundle.items, state.bundle.groupsByItem).cart);
  }, [cartHydrated, state]);

  useEffect(() => {
    if (cartHydrated) void AsyncStorage.setItem(cartKey(token), JSON.stringify(cart));
  }, [cart, token, cartHydrated]);

  // Live item availability while online.
  const readyRestaurantId = state.status === "ready" && !state.fromCache ? state.bundle.restaurant.id : null;
  useEffect(() => {
    if (!readyRestaurantId) return;
    const restaurantId = readyRestaurantId;
    const channel = supabase
      .channel(`items-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const updated = payload.new as MenuItem;
          setState((prev) =>
            prev.status === "ready"
              ? {
                  ...prev,
                  bundle: {
                    ...prev.bundle,
                    items: prev.bundle.items.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)),
                  },
                }
              : prev,
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [readyRestaurantId]);

  const addToCart = useCallback((line: CartLine) => setCart((c) => addLineBase(c, line)), []);
  const updateQty = useCallback((key: string, qty: number) => setCart((c) => setQtyBase(c, key, qty)), []);
  const setCartNote = useCallback((note: string) => setCart((c) => ({ ...c, note })), []);
  const clearCart = useCallback(() => setCart(emptyCart("", token)), [token]);

  const submitCart = useCallback(
    async (payloadCart: Cart, language: string, clientRef: string): Promise<PlaceOrderResult> => {
      await ensureCustomerSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(functionsUrl("place-order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ ...toOrderPayload(payloadCart, language), client_ref: clientRef }),
      });
      // Non-JSON error bodies (gateway 502s) must surface as an HTTP error,
      // never masquerade as a network failure → queue.
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.order) {
        return { ok: false, errorCode: (json?.error?.code as string) ?? "unknown" };
      }
      return { ok: true, orderId: json.order.id as string };
    },
    [],
  );

  const placeOrder = useCallback(
    async (language: string): Promise<PlaceOrderResult> => {
      if (submittingRef.current) return { ok: false };
      submittingRef.current = true;
      try {
        // Idempotency key survives into the queue: even if the first request
        // committed but the response was lost, the retry cannot duplicate it.
        const clientRef = randomUUID();
        try {
          return await submitCart(cart, language, clientRef);
        } catch {
          // fetch threw → offline. Move the cart into the queue (P8): the
          // live cart empties; new items form a separate future order.
          const payload: QueuedPayload = { cart, language, clientRef };
          await AsyncStorage.setItem(queueKey(token), JSON.stringify(payload));
          setQueuedOrder({
            count: cart.lines.reduce((s, l) => s + l.qty, 0),
            totalMillimes: cart.lines.reduce((s, l) => s + l.unitPriceMillimes * l.qty, 0),
          });
          setCart(emptyCart("", token));
          return { ok: false, queued: true };
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [cart, submitCart, token],
  );

  const retryQueued = useCallback(
    async (overrideLanguage?: string): Promise<PlaceOrderResult> => {
      if (submittingRef.current) return { ok: false };
      submittingRef.current = true;
      try {
        const raw = await AsyncStorage.getItem(queueKey(token));
        if (!raw) return { ok: false };
        const queued = JSON.parse(raw) as QueuedPayload;
        try {
          const result = await submitCart(queued.cart, overrideLanguage ?? queued.language, queued.clientRef);
          if (result.ok) {
            await AsyncStorage.removeItem(queueKey(token));
            setQueuedOrder(null);
            setQueuedPlacedOrderId(result.orderId ?? null);
          } else {
            // The server explicitly rejected it (item sold out, table gone…):
            // dequeue and hand the lines back to the cart for editing.
            await AsyncStorage.removeItem(queueKey(token));
            setQueuedOrder(null);
            setCart((c) => ({ ...c, lines: [...queued.cart.lines, ...c.lines], note: c.note || queued.cart.note }));
          }
          return result;
        } catch {
          return { ok: false, queued: true };
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [submitCart, token],
  );

  // Auto-retry the queued order when connectivity returns; the queued
  // payload carries its own language and idempotency key.
  const retryRef = useRef(retryQueued);
  useEffect(() => {
    retryRef.current = retryQueued;
  }, [retryQueued]);
  const hasQueuedOrder = queuedOrder !== null;
  useEffect(() => {
    if (online && hasQueuedOrder) {
      void retryRef.current();
    }
  }, [online, hasQueuedOrder]);

  const callWaiter = useCallback(
    async (reason: string, note: string): Promise<boolean> => {
      try {
        await ensureCustomerSession();
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch(functionsUrl("call-waiter"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ qr_token: token, reason, note }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [token],
  );

  const value = useMemo<VenueContextValue>(
    () => ({
      state,
      cart,
      online,
      cachedAt,
      queuedOrder,
      queuedPlacedOrderId,
      addToCart,
      updateQty,
      setCartNote,
      clearCart,
      placeOrder,
      retryQueued,
      callWaiter,
    }),
    [state, cart, online, cachedAt, queuedOrder, queuedPlacedOrderId, addToCart, updateQty, setCartNote, clearCart, placeOrder, retryQueued, callWaiter],
  );

  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

export function useVenueState(): VenueContextValue {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error("useVenueState must be used inside VenueProvider");
  return ctx;
}

/** Convenience: unwraps a ready bundle (only call under a ready guard). */
export function useVenue(): VenueBundle & Omit<VenueContextValue, "state"> {
  const ctx = useVenueState();
  if (ctx.state.status !== "ready") throw new Error("venue not ready");
  const { state, ...rest } = ctx;
  return { ...state.bundle, ...rest };
}
