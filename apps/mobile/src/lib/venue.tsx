import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addLine as addLineBase,
  attachTable,
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
  DEFAULT_GEOFENCE_M,
} from "@chehia/shared";
import { ensureCustomerSession, functionsUrl, supabase, supabaseAnonKey } from "./supabase";
import { LocationGateProvider } from "./location-gate";
import { ThemeProvider, resolveThemeColors } from "./theme";

/** Customer position sent with a browse order so the server can verify presence. */
export interface CustomerGeo {
  lat: number;
  lng: number;
  accuracyM: number | null;
}

/** A table the customer is ordering to — carries qr_token only in the scanned flow. */
export type TableChoice = Pick<Table, "id" | "label" | "zone"> & { qr_token?: string };

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
  /** Customer position captured at queue time (location-gated venues); retried as-is. */
  geo?: CustomerGeo | null;
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
  /** URL prefix for this venue's screens: `/r/{slug}/t/{token}` or `/r/{slug}`. */
  basePath: string;
  /** True in the discovery/browse flow (table picked in-session, no qr_token). */
  browse: boolean;
  /** Browse flow: choose (or change) the table. Persists into the cart + bundle. */
  setTable: (table: TableChoice) => void;
  cart: Cart;
  online: boolean;
  cachedAt: string | null;
  queuedOrder: { count: number; totalMillimes: number } | null;
  /** Set when a queued order was auto-submitted successfully (navigate to tracking). */
  queuedPlacedOrderId: string | null;
  /** Consume the one-shot above once the cart screen has navigated to it. */
  clearQueuedPlaced: () => void;
  addToCart: (line: CartLine) => void;
  updateQty: (key: string, qty: number) => void;
  setCartNote: (note: string) => void;
  clearCart: () => void;
  placeOrder: (language: string, geo?: CustomerGeo | null) => Promise<PlaceOrderResult>;
  retryQueued: (overrideLanguage?: string) => Promise<PlaceOrderResult>;
  callWaiter: (reason: string, note: string) => Promise<boolean>;
  /** Most-recent order placed from this device for this venue/table (kept ~4h). */
  activeOrder: { id: string } | null;
  /** Remember a just-placed order so the customer can navigate back to it. */
  rememberOrder: (id: string) => void;
  /** Forget the tracked order (called when it reaches a terminal state). */
  forgetOrder: () => void;
}

const VenueContext = createContext<VenueContextValue | null>(null);

/** Cache/cart/queue are keyed by the flow's stable target: the token (scanned)
 * or the slug (browse — one cart while browsing, table chosen later). */
const menuCacheKey = (slug: string, target: string) => `chehia.menu.${slug}.${target}`;
const cartKey = (target: string) => `chehia.cart.${target}`;
const queueKey = (target: string) => `chehia.queue.${target}`;
const orderKey = (target: string) => `chehia.order.${target}`;

// Keep the "return to your order" pointer ~4h: long enough to finish a meal,
// short enough it doesn't surface to the next customer at the same table.
const ACTIVE_ORDER_TTL_MS = 4 * 60 * 60 * 1000;

// Server rejections of a QUEUED order that are TRANSIENT — keep the order
// queued and retry later, rather than silently dropping it back to the cart.
// auth_failed: anonymous sign-in disabled/rate-limited; rate_limited &
// too_many_open_orders: the place-order abuse throttles (429) that clear with
// time. A permanent rejection (item sold out, table gone, invalid modifier)
// is NOT here — those hand the lines back to the cart for the customer to edit.
const TRANSIENT_ORDER_ERRORS = new Set(["auth_failed", "rate_limited", "too_many_open_orders"]);

// Bump when the cached VenueBundle shape changes so a stale-shape entry written
// by a previous app version is discarded (cache miss) instead of hydrating a
// mismatched object that could crash the offline menu.
const MENU_CACHE_VERSION = 1;

/** Shared menu load: categories, items, modifier structure for a restaurant. */
async function fetchMenu(
  restaurantId: string,
): Promise<Pick<VenueBundle, "categories" | "items" | "groupsByItem">> {
  const [{ data: categories }, { data: items }, { data: groups }, { data: modifiers }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order")
      .overrideTypes<Category[], { merge: false }>(),
    supabase
      .from("items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .overrideTypes<MenuItem[], { merge: false }>(),
    supabase
      .from("modifier_groups")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .overrideTypes<Omit<ModifierGroup, "modifiers">[], { merge: false }>(),
    supabase
      .from("modifiers")
      .select("*")
      .eq("restaurant_id", restaurantId)
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

  return { categories: categories ?? [], items: items ?? [], groupsByItem };
}

/** Load the active venue by slug. Returns null for a genuine not-found; THROWS
 * on network/database failures so the caller can fall back to a cached menu. */
async function fetchRestaurant(slug: string): Promise<Restaurant | null> {
  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<Restaurant>();
  if (error) throw new Error("network");
  return restaurant;
}

/**
 * Scanned flow: venue + the table resolved from its QR token. Returns null only
 * for a genuine "not found" (bad slug/token); THROWS on network/DB failures.
 */
async function fetchScannedBundle(slug: string, token: string): Promise<VenueBundle | null> {
  const restaurant = await fetchRestaurant(slug);
  if (!restaurant) return null;

  // Resolve the table via a token-scoped RPC (qr_token is a capability and must
  // not be enumerable). Verify it belongs to this slug's restaurant.
  const { data: resolved, error: tableError } = await supabase
    .rpc("resolve_table", { p_qr_token: token })
    .maybeSingle<{ id: string; restaurant_id: string; label: string; zone: string }>();
  if (tableError) throw new Error("network");
  if (!resolved || resolved.restaurant_id !== restaurant.id) return null;
  const table: TableChoice = {
    id: resolved.id,
    label: resolved.label,
    zone: resolved.zone,
    qr_token: token,
  };

  return { restaurant, table, ...(await fetchMenu(restaurant.id)) };
}

/**
 * Browse flow: venue + its menu + the tables the customer can pick from (via the
 * `list_venue_tables` RPC — id/label/zone only, never the qr_token).
 */
async function fetchBrowseBundle(slug: string): Promise<VenueBundle | null> {
  const restaurant = await fetchRestaurant(slug);
  if (!restaurant) return null;

  const { data: tableRows, error } = await supabase.rpc("list_venue_tables", { p_slug: slug });
  if (error) throw new Error("network");
  const rows = (tableRows ?? []) as { id: string; label: string; zone: string; sort_order: number }[];
  const tables: TableChoice[] = rows.map((r) => ({ id: r.id, label: r.label, zone: r.zone }));

  return { restaurant, table: null, tables, ...(await fetchMenu(restaurant.id)) };
}

type ProviderProps =
  | { slug: string; token: string; children: React.ReactNode }
  | { slug: string; browse: true; children: React.ReactNode };

export function VenueProvider(props: ProviderProps) {
  const slug = props.slug;
  const browse = "browse" in props;
  const token = browse ? "" : props.token;
  // The storage target: the token (scanned, per-QR cart) or the slug (browse,
  // one cart per venue). basePath mirrors the route the screens live under.
  const target = browse ? `v.${slug}` : token;
  const basePath = browse ? `/r/${slug}` : `/r/${slug}/t/${token}`;

  const [state, setState] = useState<VenueState>({ status: "loading" });
  const [cart, setCart] = useState<Cart>(() => emptyCart("", token));
  const [cartHydrated, setCartHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [queuedOrder, setQueuedOrder] = useState<{ count: number; totalMillimes: number } | null>(null);
  const [queuedPlacedOrderId, setQueuedPlacedOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<{ id: string } | null>(null);
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
        const bundle = browse ? await fetchBrowseBundle(slug) : await fetchScannedBundle(slug, token);
        if (cancelled) return;
        if (!bundle) {
          setState({ status: "invalid" });
          return;
        }
        setState({ status: "ready", bundle, fromCache: false });
        setCachedAt(null);
        // Cache the full bundle (table included) keyed per slug+target.
        await AsyncStorage.setItem(
          menuCacheKey(slug, target),
          JSON.stringify({ v: MENU_CACHE_VERSION, bundle, at: new Date().toISOString() }),
        );
      } catch {
        // Network failure → cached menu.
        const raw = await AsyncStorage.getItem(menuCacheKey(slug, target));
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { v?: number; bundle: VenueBundle; at: string };
            // Ignore a cache entry from an older, incompatible bundle shape.
            if (parsed.v === MENU_CACHE_VERSION && parsed.bundle) {
              setState({ status: "ready", bundle: parsed.bundle, fromCache: true });
              setCachedAt(parsed.at);
              return;
            }
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
  }, [slug, token, target, browse]);

  // Hydrate cart + queued order. The cart is reconciled against the live
  // menu once it arrives (stale prices/vanished items are corrected).
  useEffect(() => {
    void (async () => {
      const [rawCart, rawQueue] = await Promise.all([
        AsyncStorage.getItem(cartKey(target)),
        AsyncStorage.getItem(queueKey(target)),
      ]);
      if (rawCart) {
        try {
          const parsed = JSON.parse(rawCart) as Cart;
          // Scanned carts are token-keyed; browse carts have no token but a tableId.
          const sameTarget = browse ? parsed.qrToken === "" : parsed.qrToken === token;
          if (sameTarget && Array.isArray(parsed.lines)) setCart(parsed);
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
  }, [target, token, browse]);

  // Reconcile the hydrated cart when fresh (non-cache) menu data is ready.
  // Runs exactly once per mount — post-hydration correction, not a render loop.
  // Also restores a browse table picked earlier, dropping it if no longer valid.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (!cartHydrated || reconciledRef.current) return;
    if (state.status !== "ready" || state.fromCache) return;
    reconciledRef.current = true;
    const bundle = state.bundle;
    // Browse flow: a table picked in an earlier session is restored only if it is
    // still available; otherwise the stale tableId is dropped so the picker
    // reappears (and the cart can't submit against a phantom table).
    const restored = browse && cart.tableId ? bundle.tables?.find((tb) => tb.id === cart.tableId) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart((c) => {
      const next = reconcileCart(c, bundle.items, bundle.groupsByItem).cart;
      return browse && next.tableId && !restored ? { ...next, tableId: undefined } : next;
    });
    if (restored) {
      setState((prev) => (prev.status === "ready" ? { ...prev, bundle: { ...prev.bundle, table: restored } } : prev));
    }
  }, [cartHydrated, state, browse, cart.tableId]);

  useEffect(() => {
    if (cartHydrated) void AsyncStorage.setItem(cartKey(target), JSON.stringify(cart));
  }, [cart, target, cartHydrated]);

  // Restore a recent active order so "return to your order" survives navigating
  // away, backgrounding, or a cold app start. Stale pointers (past TTL) are dropped.
  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(orderKey(target));
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { id?: string; at?: number };
        if (parsed.id && typeof parsed.at === "number" && Date.now() - parsed.at < ACTIVE_ORDER_TTL_MS) {
          setActiveOrder({ id: parsed.id });
        } else {
          await AsyncStorage.removeItem(orderKey(target));
        }
      } catch {
        await AsyncStorage.removeItem(orderKey(target));
      }
    })();
  }, [target]);

  const rememberOrder = useCallback(
    (id: string) => {
      setActiveOrder({ id });
      void AsyncStorage.setItem(orderKey(target), JSON.stringify({ id, at: Date.now() }));
    },
    [target],
  );

  const forgetOrder = useCallback(() => {
    setActiveOrder(null);
    void AsyncStorage.removeItem(orderKey(target));
  }, [target]);

  // One-shot: the cart screen navigates to a just-auto-placed queued order, then
  // clears this so re-opening the cart doesn't re-eject the customer to it.
  const clearQueuedPlaced = useCallback(() => setQueuedPlacedOrderId(null), []);

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

  // Browse flow: pick (or change) the table. Attaches it to the cart (order is
  // placed by table_id) and surfaces it on the bundle so the shared screens —
  // built for the scanned flow's fixed table — render it unchanged.
  const setTable = useCallback((next: TableChoice) => {
    setCart((c) => attachTable(c, next.id));
    setState((prev) => (prev.status === "ready" ? { ...prev, bundle: { ...prev.bundle, table: next } } : prev));
  }, []);

  const addToCart = useCallback((line: CartLine) => setCart((c) => addLineBase(c, line)), []);
  const updateQty = useCallback((key: string, qty: number) => setCart((c) => setQtyBase(c, key, qty)), []);
  const setCartNote = useCallback((note: string) => setCart((c) => ({ ...c, note })), []);
  const clearCart = useCallback(
    () =>
      setCart((c) => {
        const base = emptyCart("", token);
        // Browse: keep the chosen table so a follow-up order still targets it.
        return browse && c.tableId ? attachTable(base, c.tableId) : base;
      }),
    [token, browse],
  );

  const submitCart = useCallback(
    async (
      payloadCart: Cart,
      language: string,
      clientRef: string,
      geo?: CustomerGeo | null,
    ): Promise<PlaceOrderResult> => {
      // An auth failure (anonymous sign-in disabled or rate-limited) is NOT a
      // network outage — surface it as an error instead of silently queuing the
      // order offline forever, which the outer catch would otherwise do.
      try {
        await ensureCustomerSession();
      } catch {
        return { ok: false, errorCode: "auth_failed" };
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(functionsUrl("place-order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          apikey: supabaseAnonKey,
        },
        // Customer coords ride along for location-gated browse venues (ignored by
        // the server for scanned/non-gated orders). Only sent when present.
        body: JSON.stringify({
          ...toOrderPayload(payloadCart, language),
          client_ref: clientRef,
          ...(geo
            ? {
                customer_lat: geo.lat,
                customer_lng: geo.lng,
                ...(geo.accuracyM != null ? { customer_accuracy_m: geo.accuracyM } : {}),
              }
            : {}),
        }),
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
    async (language: string, geo?: CustomerGeo | null): Promise<PlaceOrderResult> => {
      if (submittingRef.current) return { ok: false };
      submittingRef.current = true;
      try {
        // Idempotency key survives into the queue: even if the first request
        // committed but the response was lost, the retry cannot duplicate it.
        const clientRef = randomUUID();
        try {
          const result = await submitCart(cart, language, clientRef, geo);
          if (result.ok && result.orderId) {
            rememberOrder(result.orderId);
            // Clear the cart after a placed order so a follow-up order starts
            // fresh (keep the browse table for a quick re-order). Without this
            // the persistent cart bar keeps the just-ordered items and "Add
            // items" could re-submit them as a duplicate.
            setCart((c) => {
              const base = emptyCart("", token);
              return browse && c.tableId ? attachTable(base, c.tableId) : base;
            });
          }
          return result;
        } catch {
          // fetch threw → offline. Move the cart into the queue (P8): the
          // live cart empties; new items form a separate future order. The
          // captured coords ride along so the retry still satisfies the gate.
          const payload: QueuedPayload = { cart, language, clientRef, geo };
          await AsyncStorage.setItem(queueKey(target), JSON.stringify(payload));
          setQueuedOrder({
            count: cart.lines.reduce((s, l) => s + l.qty, 0),
            totalMillimes: cart.lines.reduce((s, l) => s + l.unitPriceMillimes * l.qty, 0),
          });
          // Empty the live cart but keep the browse table for the next order.
          setCart((c) => {
            const base = emptyCart("", token);
            return browse && c.tableId ? attachTable(base, c.tableId) : base;
          });
          return { ok: false, queued: true };
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [cart, submitCart, target, token, browse, rememberOrder],
  );

  const retryQueued = useCallback(
    async (overrideLanguage?: string): Promise<PlaceOrderResult> => {
      if (submittingRef.current) return { ok: false };
      submittingRef.current = true;
      try {
        const raw = await AsyncStorage.getItem(queueKey(target));
        if (!raw) return { ok: false };
        const queued = JSON.parse(raw) as QueuedPayload;
        try {
          const result = await submitCart(queued.cart, overrideLanguage ?? queued.language, queued.clientRef, queued.geo);
          if (result.ok) {
            await AsyncStorage.removeItem(queueKey(target));
            setQueuedOrder(null);
            setQueuedPlacedOrderId(result.orderId ?? null);
            if (result.orderId) rememberOrder(result.orderId);
          } else if (TRANSIENT_ORDER_ERRORS.has(result.errorCode ?? "")) {
            // Transient (auth disabled, rate-limited, or the open-order cap):
            // keep the order queued so the next connectivity change or manual
            // retry tries again, rather than silently dropping it.
            return { ok: false, queued: true };
          } else {
            // The server explicitly rejected it (item sold out, table gone,
            // invalid modifier…): dequeue and hand the lines back to the cart
            // for editing. Fold them in through addLine so an identical line
            // the customer re-added while offline MERGES (no duplicate key,
            // qty cap enforced) instead of a raw concat that would break the
            // stepper on colliding keys.
            await AsyncStorage.removeItem(queueKey(target));
            setQueuedOrder(null);
            setCart((c) =>
              queued.cart.lines.reduce((acc, line) => addLineBase(acc, line), {
                ...c,
                note: c.note || queued.cart.note,
              }),
            );
          }
          return result;
        } catch {
          return { ok: false, queued: true };
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [submitCart, target, rememberOrder],
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
      // Waiter calls are keyed by the physical table. Scanned flow uses the
      // qr_token; browse flow uses the picked table_id.
      const target =
        state.status === "ready" && state.bundle.table
          ? state.bundle.table.qr_token
            ? { qr_token: state.bundle.table.qr_token }
            : { table_id: state.bundle.table.id }
          : token
            ? { qr_token: token }
            : null;
      if (!target) return false;
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
          body: JSON.stringify({ ...target, reason, note }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [state, token],
  );

  const value = useMemo<VenueContextValue>(
    () => ({
      state,
      basePath,
      browse,
      setTable,
      cart,
      online,
      cachedAt,
      queuedOrder,
      queuedPlacedOrderId,
      clearQueuedPlaced,
      addToCart,
      updateQty,
      setCartNote,
      clearCart,
      placeOrder,
      retryQueued,
      callWaiter,
      activeOrder,
      rememberOrder,
      forgetOrder,
    }),
    [state, basePath, browse, setTable, cart, online, cachedAt, queuedOrder, queuedPlacedOrderId, clearQueuedPlaced, addToCart, updateQty, setCartNote, clearCart, placeOrder, retryQueued, callWaiter, activeOrder, rememberOrder, forgetOrder],
  );

  // Runtime theme (Epic 1): re-skin every downstream screen from the venue's
  // appearance. Falls back to the default "Harissa" theme until the venue loads.
  // The restaurant reference is stable across realtime item updates, so this only
  // recomputes when the appearance blob actually changes.
  const appearanceRaw = state.status === "ready" ? state.bundle.restaurant.appearance : null;
  const themeColors = useMemo(() => resolveThemeColors(appearanceRaw), [appearanceRaw]);

  // Location gate (customer side): only the browse flow of a venue that opted in
  // AND has a map pin. The scanned flow (qr_token proves presence) is exempt, so
  // `applies` stays false there and the gate is inert. Fed with primitives so
  // the provider only recomputes when the pin/radius actually change.
  const gateRestaurant = state.status === "ready" ? state.bundle.restaurant : null;
  const gateApplies =
    browse && !!gateRestaurant?.require_location && gateRestaurant.latitude != null && gateRestaurant.longitude != null;

  return (
    <VenueContext.Provider value={value}>
      <ThemeProvider value={themeColors}>
        <LocationGateProvider
          applies={gateApplies}
          lat={gateRestaurant?.latitude ?? null}
          lng={gateRestaurant?.longitude ?? null}
          radiusM={gateRestaurant?.geofence_radius_m ?? DEFAULT_GEOFENCE_M}
        >
          {props.children}
        </LocationGateProvider>
      </ThemeProvider>
    </VenueContext.Provider>
  );
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
