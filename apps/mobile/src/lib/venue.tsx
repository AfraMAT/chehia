import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addLine as addLineBase,
  emptyCart,
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

interface VenueContextValue {
  state: VenueState;
  cart: Cart;
  online: boolean;
  cachedAt: string | null;
  queuedOrder: { count: number; totalMillimes: number } | null;
  addToCart: (line: CartLine) => void;
  updateQty: (key: string, qty: number) => void;
  setCartNote: (note: string) => void;
  clearCart: () => void;
  placeOrder: (language: string) => Promise<PlaceOrderResult>;
  retryQueued: (language: string) => Promise<PlaceOrderResult>;
  callWaiter: (reason: string, note: string) => Promise<boolean>;
}

const VenueContext = createContext<VenueContextValue | null>(null);

const menuCacheKey = (slug: string) => `chehia.menu.${slug}`;
const cartKey = (token: string) => `chehia.cart.${token}`;
const queueKey = (token: string) => `chehia.queue.${token}`;

async function fetchBundle(slug: string, token: string): Promise<VenueBundle | null> {
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<Restaurant>();
  if (!restaurant) return null;

  const { data: table } = await supabase
    .from("tables")
    .select("id, label, zone, qr_token")
    .eq("restaurant_id", restaurant.id)
    .eq("qr_token", token)
    .eq("is_active", true)
    .maybeSingle<Pick<Table, "id" | "label" | "zone" | "qr_token">>();
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
        await AsyncStorage.setItem(
          menuCacheKey(slug),
          JSON.stringify({ bundle: { ...bundle, table: undefined }, at: new Date().toISOString() }),
        );
      } catch {
        // Network failure → cached menu.
        const raw = await AsyncStorage.getItem(menuCacheKey(slug));
        if (cancelled) return;
        if (raw) {
          try {
            const { bundle, at } = JSON.parse(raw) as { bundle: Omit<VenueBundle, "table">; at: string };
            setState({
              status: "ready",
              bundle: { ...bundle, table: { id: "", label: "", zone: "", qr_token: token } },
              fromCache: true,
            });
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

  // Hydrate cart + queued order.
  useEffect(() => {
    void (async () => {
      const [rawCart, rawQueue] = await Promise.all([
        AsyncStorage.getItem(cartKey(token)),
        AsyncStorage.getItem(queueKey(token)),
      ]);
      if (rawCart) {
        try {
          const parsed = JSON.parse(rawCart) as Cart;
          if (parsed.qrToken === token) setCart(parsed);
        } catch {
          // fresh cart
        }
      }
      if (rawQueue) {
        try {
          const parsed = JSON.parse(rawQueue) as Cart;
          setQueuedOrder({
            count: parsed.lines.reduce((s, l) => s + l.qty, 0),
            totalMillimes: parsed.lines.reduce((s, l) => s + l.unitPriceMillimes * l.qty, 0),
          });
        } catch {
          // ignore
        }
      }
      setCartHydrated(true);
    })();
  }, [token]);

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
    async (payloadCart: Cart, language: string): Promise<PlaceOrderResult> => {
      const userId = await ensureCustomerSession();
      void userId;
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(functionsUrl("place-order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify(toOrderPayload(payloadCart, language)),
      });
      const json = await response.json();
      if (!response.ok) {
        return { ok: false, errorCode: json?.error?.code as string };
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
        const result = await submitCart(cart, language);
        if (result.ok) {
          clearCart();
          await AsyncStorage.removeItem(queueKey(token));
          setQueuedOrder(null);
        }
        return result;
      } catch {
        // Offline: queue for auto-retry (P8).
        await AsyncStorage.setItem(queueKey(token), JSON.stringify(cart));
        setQueuedOrder({
          count: cart.lines.reduce((s, l) => s + l.qty, 0),
          totalMillimes: cart.lines.reduce((s, l) => s + l.unitPriceMillimes * l.qty, 0),
        });
        return { ok: false, queued: true };
      } finally {
        submittingRef.current = false;
      }
    },
    [cart, clearCart, submitCart, token],
  );

  const retryQueued = useCallback(
    async (language: string): Promise<PlaceOrderResult> => {
      const raw = await AsyncStorage.getItem(queueKey(token));
      if (!raw) return { ok: false };
      const queued = JSON.parse(raw) as Cart;
      try {
        const result = await submitCart(queued, language);
        if (result.ok) {
          await AsyncStorage.removeItem(queueKey(token));
          setQueuedOrder(null);
          clearCart();
        }
        return result;
      } catch {
        return { ok: false, queued: true };
      }
    },
    [clearCart, submitCart, token],
  );

  // Auto-retry the queued order when connectivity returns.
  const retryRef = useRef(retryQueued);
  useEffect(() => {
    retryRef.current = retryQueued;
  }, [retryQueued]);
  const hasQueuedOrder = queuedOrder !== null;
  useEffect(() => {
    if (online && hasQueuedOrder) {
      void retryRef.current("fr");
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
      addToCart,
      updateQty,
      setCartNote,
      clearCart,
      placeOrder,
      retryQueued,
      callWaiter,
    }),
    [state, cart, online, cachedAt, queuedOrder, addToCart, updateQty, setCartNote, clearCart, placeOrder, retryQueued, callWaiter],
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
