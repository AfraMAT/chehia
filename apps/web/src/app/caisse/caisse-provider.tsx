"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addLine as addLineBase,
  cartCount,
  cartTotal,
  emptyCart,
  setQty as setQtyBase,
  type Cart,
  type CartLine,
  type Category,
  type Language,
  type MenuItem,
  type Modifier,
  type ModifierGroup,
  type Restaurant,
  type StaffRole,
} from "@chehia/shared";
import { callFunction, getSupabase } from "@/lib/supabase";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { buildReceiptData, type ReceiptData } from "./_register/receipt-types";
import {
  allSales,
  deadLetter,
  enqueueSale,
  failedCount as queueFailedCount,
  pendingCount as queuePendingCount,
  removeSale,
  updateSale,
  type FrozenLine,
  type PendingSale,
} from "./_register/offline-queue";

/**
 * Chehia Caisse — the staff point-of-sale register (caisse.chehia.app).
 *
 * A separate surface from the back-office portal: a cashier signs in on a
 * tablet or the counter PC and rings up sales. This provider loads the signed-in
 * staff member + their venue + the full menu, holds the working "ticket" (an
 * in-memory cart), and fires it to the kitchen.
 *
 * Orders are created through `register-order` (staff path: server reprices,
 * validates modifiers, idempotent on client_ref, stamps origin=counter) and
 * settled through `settle-order` (records payment, computes cash rounding/change
 * server-side, stamps a gap-free fiscal number). Counter/takeaway sales are
 * attributed to a per-venue "Comptoir" service table so the table-keyed order
 * path works unchanged.
 */

export type OrderType = "comptoir" | "emporter" | "surplace";

export interface CaisseStaff {
  id: string;
  restaurant_id: string;
  role: StaffRole;
  display_name: string;
}

export interface CaisseTable {
  id: string;
  label: string;
  zone: string;
}

export interface PlacedOrder {
  id: string;
  order_number: string;
  total_millimes: number;
  table_label?: string;
}

export type PlaceResult =
  | { ok: true; order: PlacedOrder }
  | { ok: false; code: string };

export type TenderMethod = "cash" | "card" | "d17";

export type SettleResult =
  | { ok: true; fiscalNumber: string; amount: number; change: number; tax: number; timbre: number; rounding: number }
  | { ok: false; code: string };

/** A placed-but-unpaid customer order shown in the counter-settlement picker. */
export interface UnpaidOrder {
  id: string;
  order_number: string;
  table_id: string;
  table_label: string;
  total_millimes: number;
  status: string;
  created_at: string;
  lines: { id: string; name_snapshot: Record<string, string>; qty: number; unit_price_millimes: number; modifiers_snapshot: { choice: Record<string, string> }[]; note: string }[];
}

export interface RestaurantFiscal {
  matricule_fiscal: string;
  regime: string;
  tva_registered: boolean;
  default_tva_rate: number;
  timbre_millimes: number;
  cash_rounding_millimes: number;
  receipt_footer: string;
}

export interface CashSession {
  id: string;
  opening_float_millimes: number;
  opened_at: string;
  status: string;
  expected_cash_millimes: number | null;
  counted_cash_millimes: number | null;
  over_short_millimes: number | null;
}

export type CashActionResult = { ok: true } | { ok: false; code: string };

export interface CashReport {
  session: CashSession;
  orders_count: number;
  sales_total_millimes: number;
  by_method: Record<string, number>;
  tax_total_millimes: number;
  timbre_total_millimes: number;
  refunds_total_millimes: number;
}

/** Register order type → the edge function's order_type. */
const ORDER_TYPE_MAP: Record<OrderType, string> = {
  comptoir: "walk_in",
  emporter: "takeaway",
  surplace: "dine_in",
};

interface CaisseContextValue {
  staff: CaisseStaff;
  restaurant: Restaurant;
  canManage: boolean;
  fiscal: RestaurantFiscal | null;
  // Menu
  categories: Category[];
  items: MenuItem[];
  groupsByItem: Record<string, ModifierGroup[]>;
  // Ticket (the working cart)
  ticket: Cart;
  ticketCount: number;
  ticketTotal: number;
  addToTicket: (line: CartLine) => void;
  setTicketQty: (key: string, qty: number) => void;
  clearTicket: () => void;
  // Order routing
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  table: CaisseTable | null;
  setTable: (t: CaisseTable | null) => void;
  tables: CaisseTable[];
  serviceTable: CaisseTable | null;
  /** Fire the current ticket to the kitchen (creates the order). */
  placeOrder: () => Promise<PlaceResult>;
  /** Record payment + stamp the fiscal receipt for a created order. */
  settleOrder: (orderId: string, method: TenderMethod, tenderedMillimes: number | null) => Promise<SettleResult>;
  /** Unpaid customer (QR) orders awaiting counter payment — so their cash
   * reaches the drawer and the Z-report. Refreshed live. */
  unpaidOrders: UnpaidOrder[];
  refreshUnpaidOrders: () => Promise<void>;
  /** An existing order the cashier chose to settle at the counter (or null for
   * a fresh ticket sale). The tender sheet reads this to pay it directly. */
  settleTarget: UnpaidOrder | null;
  setSettleTarget: (o: UnpaidOrder | null) => void;
  /** The most recent completed sale, for the on-screen + printed receipt. */
  lastSale: ReceiptData | null;
  setLastSale: (data: ReceiptData | null) => void;
  // Cash drawer session
  cashSession: CashSession | null;
  openCashSession: (openingFloatMillimes: number) => Promise<CashActionResult>;
  closeCashSession: (countedCashMillimes: number) => Promise<{ ok: true; session: CashSession } | { ok: false; code: string }>;
  getCashReport: () => Promise<CashReport | null>;
  // Offline
  online: boolean;
  pendingCount: number;
  /** Offline sales the server permanently rejected — need cashier reconciliation. */
  failedCount: number;
  /** Store a completed sale locally when offline; returns its provisional local id. */
  queueSale: (method: TenderMethod, tenderedMillimes: number | null) => Promise<{ ok: boolean; localId: string }>;
  // Register lock (PIN)
  locked: boolean;
  hasPin: boolean;
  lock: () => void;
  unlock: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<boolean>;
  // Time-clock
  myShift: { id: string; clock_in: string } | null;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  signOut: () => Promise<void>;
}

const CaisseContext = createContext<CaisseContextValue | null>(null);

const LOGIN_PATH = "/business/login";

type LoadState = "loading" | "ready" | "unauthenticated" | "no-staff" | "error";

/** Load the venue's menu with the browser (staff) client. Mirrors r/_venue/loader. */
async function loadMenu(restaurantId: string) {
  const supabase = getSupabase();
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
      .overrideTypes<Omit<ModifierGroup, "modifiers">[]>(),
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

export function CaisseProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [staff, setStaff] = useState<CaisseStaff | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<{
    categories: Category[];
    items: MenuItem[];
    groupsByItem: Record<string, ModifierGroup[]>;
  }>({ categories: [], items: [], groupsByItem: {} });
  const [tables, setTables] = useState<CaisseTable[]>([]);
  const [serviceTable, setServiceTable] = useState<CaisseTable | null>(null);
  const [fiscal, setFiscal] = useState<RestaurantFiscal | null>(null);
  const [lastSale, setLastSale] = useState<ReceiptData | null>(null);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [myShift, setMyShift] = useState<{ id: string; clock_in: string } | null>(null);

  const [ticket, setTicket] = useState<Cart>(() => emptyCart("", ""));
  const [orderType, setOrderType] = useState<OrderType>("comptoir");
  const [table, setTable] = useState<CaisseTable | null>(null);
  const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([]);
  const [settleTarget, setSettleTarget] = useState<UnpaidOrder | null>(null);

  const clientRefRef = useRef<string | null>(null);
  const settleRefRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user || user.is_anonymous) {
      setState("unauthenticated");
      return;
    }
    const { data: staffRow, error: staffError } = await supabase
      .from("staff")
      .select("id, restaurant_id, role, display_name")
      .eq("auth_uid", user.id)
      .eq("is_active", true)
      .maybeSingle<CaisseStaff>();
    if (staffError) {
      setState("error");
      return;
    }
    if (!staffRow) {
      setState("no-staff");
      return;
    }
    const { data: resto, error: restoError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", staffRow.restaurant_id)
      .maybeSingle<Restaurant>();
    if (restoError || !resto) {
      setState(restoError ? "error" : "no-staff");
      return;
    }

    const [menuData, { data: tableRows }, { data: fiscalRow }, { data: sessionRow }] = await Promise.all([
      loadMenu(staffRow.restaurant_id),
      supabase
        .from("tables")
        .select("id, label, zone, is_active")
        .eq("restaurant_id", staffRow.restaurant_id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("restaurant_fiscal")
        .select("matricule_fiscal, regime, tva_registered, default_tva_rate, timbre_millimes, cash_rounding_millimes, receipt_footer")
        .eq("restaurant_id", staffRow.restaurant_id)
        .maybeSingle(),
      supabase
        .from("cash_sessions")
        .select("id, opening_float_millimes, opened_at, status, expected_cash_millimes, counted_cash_millimes, over_short_millimes")
        .eq("restaurant_id", staffRow.restaurant_id)
        .eq("status", "open")
        .maybeSingle(),
    ]);

    const allTables: CaisseTable[] = (tableRows ?? []).map((r) => ({
      id: r.id as string,
      label: r.label as string,
      zone: (r.zone as string) ?? "",
    }));

    // The counter itself is modeled as a "Comptoir" service table so walk-in and
    // takeaway sales flow through the existing (table-required) order path. Owners
    // and managers may create it; other roles reuse whatever already exists.
    let service = allTables.find((t) => t.label.toLowerCase() === "comptoir") ?? null;
    const canManage = staffRow.role === "owner" || staffRow.role === "manager";
    if (!service && canManage) {
      const { data: created } = await supabase
        .from("tables")
        .insert({ restaurant_id: staffRow.restaurant_id, label: "Comptoir", zone: "" })
        .select("id, label, zone")
        .maybeSingle();
      if (created) {
        service = { id: created.id as string, label: created.label as string, zone: (created.zone as string) ?? "" };
        allTables.unshift(service);
      }
    }

    setStaff(staffRow);
    setRestaurant(resto);
    setMenu(menuData);
    setTables(allTables);
    setServiceTable(service);
    setFiscal((fiscalRow as RestaurantFiscal | null) ?? null);
    setCashSession((sessionRow as CashSession | null) ?? null);
    setTicket(emptyCart(staffRow.restaurant_id, ""));
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state === "unauthenticated") router.replace(LOGIN_PATH);
  }, [state, router]);

  useEffect(() => {
    const { data: sub } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace(LOGIN_PATH);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const addToTicket = useCallback((line: CartLine) => setTicket((c) => addLineBase(c, line)), []);
  const setTicketQty = useCallback((key: string, qty: number) => setTicket((c) => setQtyBase(c, key, qty)), []);
  const clearTicket = useCallback(() => {
    setTicket((c) => emptyCart(c.restaurantId, ""));
    clientRefRef.current = null;
    settleRefRef.current = null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    router.replace(LOGIN_PATH);
  }, [router]);

  const placeOrder = useCallback(async (): Promise<PlaceResult> => {
    if (ticket.lines.length === 0) return { ok: false, code: "empty" };
    const targetTableId = orderType === "surplace" ? table?.id : serviceTable?.id;
    if (!targetTableId) return { ok: false, code: "no_table" };

    // Stable across retries so a lost response never double-creates the order.
    clientRefRef.current ??= crypto.randomUUID();
    try {
      const { ok, data: json } = await callFunction<{
        order?: PlacedOrder;
        error?: { code?: string };
      }>("register-order", {
        table_id: targetTableId,
        order_type: ORDER_TYPE_MAP[orderType],
        language: "fr",
        note: ticket.note,
        lines: ticket.lines.map((l) => ({ item_id: l.itemId, qty: l.qty, modifier_ids: l.modifierIds, note: l.note })),
        client_ref: clientRefRef.current,
      });
      if (!ok || !json?.order) return { ok: false, code: json?.error?.code ?? "order_failed" };
      return { ok: true, order: json.order };
    } catch {
      return { ok: false, code: "network" };
    }
  }, [ticket, orderType, table, serviceTable]);

  const settleOrder = useCallback(
    async (orderId: string, method: TenderMethod, tenderedMillimes: number | null): Promise<SettleResult> => {
      settleRefRef.current ??= crypto.randomUUID();
      try {
        const { ok, data: json } = await callFunction<{
          payment?: {
            fiscal_number?: string;
            change_millimes?: number;
            amount_millimes?: number;
            tax_total_millimes?: number;
            timbre_millimes?: number;
            rounding_millimes?: number;
          };
          error?: { code?: string };
        }>("settle-order", {
          order_id: orderId,
          method,
          tendered_millimes: tenderedMillimes,
          client_ref: settleRefRef.current,
        });
        if (!ok || !json?.payment) return { ok: false, code: json?.error?.code ?? "settle_failed" };
        return {
          ok: true,
          fiscalNumber: json.payment.fiscal_number ?? "",
          amount: json.payment.amount_millimes ?? 0,
          change: json.payment.change_millimes ?? 0,
          tax: json.payment.tax_total_millimes ?? 0,
          timbre: json.payment.timbre_millimes ?? 0,
          rounding: json.payment.rounding_millimes ?? 0,
        };
      } catch {
        return { ok: false, code: "network" };
      }
    },
    [],
  );

  // Unpaid customer orders (QR/browse/group), most recent first, so the cashier
  // can settle them at the counter — the only way their cash enters the drawer
  // and the Z-report. POS-rung orders (created_by_staff) are settled at ring-up,
  // so they're excluded.
  const refreshUnpaidOrders = useCallback(async () => {
    if (!staff) return;
    const supabase = getSupabase();
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, table_id, total_millimes, status, created_at")
      .eq("restaurant_id", staff.restaurant_id)
      .is("paid_at", null)
      .is("created_by_staff", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (!orders || orders.length === 0) {
      setUnpaidOrders([]);
      return;
    }
    const ids = orders.map((o) => o.id);
    const { data: items } = await supabase
      .from("order_items")
      .select("id, order_id, name_snapshot, qty, unit_price_millimes, modifiers_snapshot, note")
      .in("order_id", ids);
    const byOrder = new Map<string, UnpaidOrder["lines"]>();
    for (const it of items ?? []) {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push({ id: it.id, name_snapshot: it.name_snapshot, qty: it.qty, unit_price_millimes: it.unit_price_millimes, modifiers_snapshot: it.modifiers_snapshot ?? [], note: it.note ?? "" });
      byOrder.set(it.order_id, arr);
    }
    const tableLabel = (id: string) => tables.find((t) => t.id === id)?.label ?? "?";
    setUnpaidOrders(orders.map((o) => ({ ...o, table_label: tableLabel(o.table_id), lines: byOrder.get(o.id) ?? [] })));
  }, [staff, tables]);

  // Load once ready + refresh live on any order change for this venue.
  useEffect(() => {
    if (!staff) return;
    void refreshUnpaidOrders();
    const supabase = getSupabase();
    const channel = supabase
      .channel(`caisse-unpaid-${staff.restaurant_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${staff.restaurant_id}` }, () => void refreshUnpaidOrders())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [staff, refreshUnpaidOrders]);

  const openCashSession = useCallback(
    async (openingFloatMillimes: number): Promise<CashActionResult> => {
      if (!staff) return { ok: false, code: "not_ready" };
      const { data, error } = await getSupabase().rpc("open_cash_session", {
        p_restaurant_id: staff.restaurant_id,
        p_opening_float_millimes: Math.max(0, Math.trunc(openingFloatMillimes)),
      });
      if (error || !data) return { ok: false, code: error?.message ?? "open_failed" };
      setCashSession(data as CashSession);
      return { ok: true };
    },
    [staff],
  );

  const closeCashSession = useCallback(
    async (countedCashMillimes: number) => {
      if (!cashSession) return { ok: false as const, code: "no_session" };
      const { data, error } = await getSupabase().rpc("close_cash_session", {
        p_session_id: cashSession.id,
        p_counted_cash_millimes: Math.max(0, Math.trunc(countedCashMillimes)),
      });
      if (error || !data) return { ok: false as const, code: error?.message ?? "close_failed" };
      setCashSession(null);
      return { ok: true as const, session: data as CashSession };
    },
    [cashSession],
  );

  const getCashReport = useCallback(async (): Promise<CashReport | null> => {
    if (!cashSession) return null;
    const { data, error } = await getSupabase().rpc("cash_session_report", { p_session_id: cashSession.id });
    if (error || !data) return null;
    return data as CashReport;
  }, [cashSession]);

  const refreshPending = useCallback(async () => {
    setPendingCount(await queuePendingCount());
    setFailedCount(await queueFailedCount());
  }, []);

  // Drain the offline queue through the (idempotent) register-order + settle-order
  // path, REPLAYING the frozen prices (never repricing — the cash was collected at
  // that price). A permanent business rejection (4xx) or a sale that won't post
  // after many tries is moved to the failed/needs-attention store, never retried
  // forever and never silently lost.
  const MAX_ATTEMPTS = 8;
  const drainQueue = useCallback(async () => {
    const sales = await allSales();
    for (const sale of sales) {
      const isPermanent = (status: number) => status >= 400 && status < 500 && status !== 408 && status !== 429;
      const bump = async () => {
        const next: PendingSale = { ...sale, attempts: (sale.attempts ?? 0) + 1 };
        if (next.attempts >= MAX_ATTEMPTS) await deadLetter(sale, "max_attempts");
        else await updateSale(next);
      };
      try {
        const created = await callFunction<{ order?: { id: string }; error?: { code?: string } }>("register-order", {
          table_id: sale.table_id,
          order_type: sale.order_type,
          language: "fr",
          note: sale.note,
          offline: true,
          captured_lines: sale.lines,
          captured_subtotal: sale.subtotal_millimes,
          client_ref: sale.client_ref,
        });
        if (!created.ok || !created.data?.order) {
          if (isPermanent(created.status)) await deadLetter(sale, created.data?.error?.code ?? `http_${created.status}`);
          else await bump();
          continue;
        }
        const settled = await callFunction<{ error?: { code?: string } }>("settle-order", {
          order_id: created.data.order.id,
          method: sale.method,
          tendered_millimes: sale.tendered_millimes,
          client_ref: sale.settle_ref,
        });
        if (!settled.ok) {
          if (isPermanent(settled.status)) await deadLetter(sale, settled.data?.error?.code ?? `settle_${settled.status}`);
          else await bump();
          continue;
        }
        await removeSale(sale.id);
      } catch {
        await bump();
      }
    }
    await refreshPending();
  }, [refreshPending]);

  const queueSale = useCallback(
    async (method: TenderMethod, tenderedMillimes: number | null): Promise<{ ok: boolean; localId: string }> => {
      if (!staff || !restaurant) return { ok: false, localId: "" };
      const targetTableId = orderType === "surplace" ? table?.id : serviceTable?.id;
      if (!targetTableId) return { ok: false, localId: "" };

      const localId = `HL-${crypto.randomUUID().slice(0, 8)}`;
      // Freeze the priced lines + total: this is what the customer paid, replayed
      // verbatim on sync so a menu/price edit can't change the recorded amount.
      const frozenLines: FrozenLine[] = ticket.lines.map((l) => ({
        item_id: l.itemId,
        qty: l.qty,
        unit_price_millimes: l.unitPriceMillimes,
        name_snapshot: l.name,
        modifiers_snapshot: l.modifierLabels.map((m) => ({ group: m.group, choice: m.choice, delta: m.delta })),
        note: l.note,
      }));
      const sale: PendingSale = {
        id: localId,
        client_ref: crypto.randomUUID(),
        settle_ref: crypto.randomUUID(),
        table_id: targetTableId,
        order_type: ORDER_TYPE_MAP[orderType],
        note: ticket.note,
        lines: frozenLines,
        subtotal_millimes: cartTotal(ticket),
        method,
        tendered_millimes: tenderedMillimes,
        at: Date.now(),
        attempts: 0,
      };
      try {
        await enqueueSale(sale);
      } catch {
        return { ok: false, localId: "" };
      }

      // Provisional receipt — fiscal math mirrors settle-order; the definitive
      // fiscal number is stamped by the server at sync.
      const isReel = fiscal?.regime === "reel";
      const timbre = isReel ? fiscal?.timbre_millimes ?? 0 : 0;
      const step = fiscal?.cash_rounding_millimes ?? 100;
      const tvaRate = isReel && fiscal?.tva_registered ? Number(fiscal.default_tva_rate ?? 0) : 0;
      const subtotal = cartTotal(ticket);
      const grossDue = subtotal + timbre;
      const amount = method === "cash" && step > 0 ? Math.round(grossDue / step) * step : grossDue;
      const rounding = method === "cash" ? amount - grossDue : 0;
      const tax = tvaRate > 0 ? Math.round(subtotal - subtotal / (1 + tvaRate / 100)) : 0;
      const change = method === "cash" && tenderedMillimes !== null ? Math.max(0, tenderedMillimes - amount) : 0;
      const orderTypeLabel = { comptoir: "Comptoir", emporter: "À emporter", surplace: "Sur place" }[orderType];
      const tableLabel = orderType === "surplace" ? (table ? `Table ${table.label}` : "—") : orderTypeLabel;
      setLastSale(
        buildReceiptData({
          restaurant,
          fiscal: fiscal ? { ...fiscal, receipt_footer: `${fiscal.receipt_footer || "Merci de votre visite !"} (ticket hors-ligne)` } : null,
          lines: ticket.lines,
          subtotalMillimes: subtotal,
          orderNumber: localId,
          fiscalNumber: "",
          orderTypeLabel,
          tableLabel,
          staffName: staff.display_name,
          method,
          tenderedMillimes: method === "cash" ? tenderedMillimes : null,
          amountMillimes: amount,
          taxMillimes: tax,
          tvaRate,
          timbreMillimes: timbre,
          roundingMillimes: rounding,
          changeMillimes: change,
          dateISO: new Date().toISOString(),
        }),
      );
      void refreshPending();
      return { ok: true, localId };
    },
    [staff, restaurant, fiscal, ticket, orderType, table, serviceTable, refreshPending],
  );

  // Connectivity — drain the queue when the network returns.
  useEffect(() => {
    const up = () => {
      setOnline(true);
      void drainQueue();
    };
    const down = () => setOnline(false);
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [drainQueue]);

  // On ready: sync anything left from a previous offline session.
  useEffect(() => {
    if (state === "ready") {
      void refreshPending();
      void drainQueue();
    }
  }, [state, refreshPending, drainQueue]);

  // Install the caisse as an offline-capable PWA — prod origin only, so the
  // service worker never controls the business/customer surfaces on the shared
  // localhost origin during dev.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!location.hostname.startsWith("caisse.")) return;
    navigator.serviceWorker.register("/caisse-sw.js").catch(() => {});
  }, []);

  // Does the cashier have a lock PIN set? And are they clocked in?
  useEffect(() => {
    if (state !== "ready") return;
    const supabase = getSupabase();
    void supabase.rpc("my_pin_is_set").then(({ data }) => setHasPin(data === true));
    void supabase.rpc("my_open_shift").then(({ data }) => {
      // A SQL function returning a composite yields an all-null row (not null)
      // when the query matches nothing — treat a missing id as "no shift".
      const row = data as { id: string | null; clock_in: string } | null;
      setMyShift(row?.id ? { id: row.id, clock_in: row.clock_in } : null);
    });
  }, [state]);

  const clockIn = useCallback(async () => {
    const { data } = await getSupabase().rpc("clock_in");
    const row = data as { id: string | null; clock_in: string } | null;
    if (row?.id) setMyShift({ id: row.id, clock_in: row.clock_in });
  }, []);
  const clockOut = useCallback(async () => {
    await getSupabase().rpc("clock_out");
    setMyShift(null);
  }, []);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const { data } = await getSupabase().rpc("verify_my_pin", { p_pin: pin });
    if (data === true) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);
  const setPin = useCallback(async (pin: string): Promise<boolean> => {
    const { error } = await getSupabase().rpc("set_my_pin", { p_pin: pin });
    if (error) return false;
    setHasPin(true);
    return true;
  }, []);

  const value = useMemo<CaisseContextValue | null>(() => {
    if (!staff || !restaurant) return null;
    return {
      staff,
      restaurant,
      canManage: staff.role === "owner" || staff.role === "manager",
      fiscal,
      categories: menu.categories,
      items: menu.items,
      groupsByItem: menu.groupsByItem,
      ticket,
      ticketCount: cartCount(ticket),
      ticketTotal: cartTotal(ticket),
      addToTicket,
      setTicketQty,
      clearTicket,
      orderType,
      setOrderType,
      table,
      setTable,
      tables,
      serviceTable,
      placeOrder,
      settleOrder,
      unpaidOrders,
      refreshUnpaidOrders,
      settleTarget,
      setSettleTarget,
      lastSale,
      setLastSale,
      cashSession,
      openCashSession,
      closeCashSession,
      getCashReport,
      online,
      pendingCount,
      failedCount,
      queueSale,
      locked,
      hasPin,
      lock,
      unlock,
      setPin,
      myShift,
      clockIn,
      clockOut,
      signOut,
    };
  }, [staff, restaurant, fiscal, menu, ticket, orderType, table, tables, serviceTable, addToTicket, setTicketQty, clearTicket, placeOrder, settleOrder, unpaidOrders, refreshUnpaidOrders, settleTarget, lastSale, cashSession, openCashSession, closeCashSession, getCashReport, online, pendingCount, failedCount, queueSale, locked, hasPin, lock, unlock, setPin, myShift, clockIn, clockOut, signOut]);

  let body: React.ReactNode;
  if (state === "no-staff") {
    body = <NoAccessScreen onSignOut={() => void signOut()} />;
  } else if (state === "error") {
    body = (
      <ErrorScreen
        onRetry={() => {
          setState("loading");
          void load();
        }}
      />
    );
    // `value` is a useMemo result, not a ref — react-hooks v7's `refs` rule
    // mis-flags this readiness read (known false positive on memoized context values).
    // eslint-disable-next-line react-hooks/refs
  } else if (state !== "ready" || !value) {
    body = (
      <Centered>
        <span className="w-8 h-8 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
      </Centered>
    );
  } else {
    body = <CaisseContext.Provider value={value}>{children}</CaisseContext.Provider>;
  }

  // Wrap the whole surface (including the error screens) so the register, its
  // sheets and the language toggle share one i18n context. French by default.
  return (
    <I18nProvider initial={(restaurant?.default_language ?? "fr") as Language} storageKey="chehia.caisse.lang">
      {body}
    </I18nProvider>
  );
}

function NoAccessScreen({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useI18n();
  return (
    <Centered>
      <h1 className="font-display font-extrabold text-xl text-ink">{t.caisse.errors.noAccessTitle}</h1>
      <p className="text-sm text-muted leading-relaxed">{t.caisse.errors.noAccessBody}</p>
      <button type="button" onClick={onSignOut} className="h-11 px-6 rounded-lg bg-ink text-cream font-extrabold text-sm cursor-pointer">
        {t.caisse.common.signOut}
      </button>
    </Centered>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <Centered>
      <h1 className="font-display font-extrabold text-xl text-ink">{t.caisse.errors.generic}</h1>
      <button
        type="button"
        onClick={onRetry}
        className="h-11 px-6 rounded-lg bg-harissa text-white font-extrabold text-sm cursor-pointer"
      >
        {t.caisse.common.retry}
      </button>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
      <div className="bg-card border border-line rounded-2xl p-8 max-w-[380px] flex flex-col items-center gap-4 text-center">
        {children}
      </div>
    </div>
  );
}

export function useCaisse(): CaisseContextValue {
  const ctx = useContext(CaisseContext);
  if (!ctx) throw new Error("useCaisse must be used inside CaisseProvider");
  return ctx;
}
