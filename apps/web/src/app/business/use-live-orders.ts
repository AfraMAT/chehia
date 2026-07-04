"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order, OrderItem, OrderStatus, Table, WaiterCall } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";

export interface LiveOrder extends Order {
  items: OrderItem[];
}

interface LiveOrdersState {
  orders: LiveOrder[];
  tables: Table[];
  calls: WaiterCall[];
  todayCount: number;
  todayRevenue: number;
  loading: boolean;
}

/**
 * Live order feed for the portal: initial load + Supabase Realtime
 * (INSERT/UPDATE on orders & waiter_calls, scoped to the restaurant by RLS).
 * Optionally beeps on new orders.
 */
export function useLiveOrders(restaurantId: string, { sound = false }: { sound?: boolean } = {}) {
  const [state, setState] = useState<LiveOrdersState>({
    orders: [],
    tables: [],
    calls: [],
    todayCount: 0,
    todayRevenue: 0,
    loading: true,
  });
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const beep = useCallback(() => {
    if (!soundRef.current) return;
    try {
      type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const play = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      };
      play(880, 0, 0.18);
      play(1174, 0.2, 0.26);
      setTimeout(() => void ctx.close(), 800);
    } catch {
      // audio unavailable: silent
    }
  }, []);

  // Monotonic id so a slow, stale reload can never clobber a newer one.
  const reloadSeqRef = useRef(0);

  const reload = useCallback(async () => {
    const supabase = getSupabase();
    const seq = ++reloadSeqRef.current;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [{ data: orders }, { data: tables }, { data: calls }, { data: todays }] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .in("status", ["new", "preparing", "ready"])
        .order("created_at", { ascending: true })
        .overrideTypes<Order[], { merge: false }>(),
      supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("sort_order")
        .overrideTypes<Table[], { merge: false }>(),
      supabase
        .from("waiter_calls")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .overrideTypes<WaiterCall[], { merge: false }>(),
      supabase
        .from("orders")
        .select("id, total_millimes, status")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startOfDay.toISOString()),
    ]);

    // Lines only for the open orders — never the venue's full history
    // (PostgREST caps unbounded queries at max_rows and truncates silently).
    const openIds = (orders ?? []).map((o) => o.id);
    const { data: items } = openIds.length
      ? await supabase
          .from("order_items")
          .select("*")
          .in("order_id", openIds)
          .overrideTypes<OrderItem[], { merge: false }>()
      : { data: [] as OrderItem[] };

    if (seq !== reloadSeqRef.current) return; // a newer reload superseded this one

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const item of items ?? []) {
      (itemsByOrder.get(item.order_id) ?? itemsByOrder.set(item.order_id, []).get(item.order_id))!.push(item);
    }

    const nonCancelled = (todays ?? []).filter((o) => o.status !== "cancelled");
    setState({
      orders: (orders ?? []).map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] })),
      tables: tables ?? [],
      calls: calls ?? [],
      todayCount: nonCancelled.length,
      todayRevenue: nonCancelled.reduce((s, o) => s + o.total_millimes, 0),
      loading: false,
    });
  }, [restaurantId]);

  useEffect(() => {
    void reload();
    const supabase = getSupabase();
    const channel = supabase
      .channel(`portal-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          beep();
          void reload();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          // Only NEW calls ring; acknowledgements just refresh below.
          beep();
          void reload();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurantId}` },
        () => void reload(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, reload, beep]);

  const setOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      // Optimistic update; realtime reload confirms.
      setState((prev) => ({
        ...prev,
        orders: prev.orders
          .map((o) => (o.id === orderId ? { ...o, status } : o))
          .filter((o) => ["new", "preparing", "ready"].includes(o.status)),
      }));
      await getSupabase().from("orders").update({ status }).eq("id", orderId);
      void reload();
    },
    [reload],
  );

  const acknowledgeCall = useCallback(
    async (callId: string) => {
      setState((prev) => ({ ...prev, calls: prev.calls.filter((c) => c.id !== callId) }));
      // Reconcile with the DB afterwards: if the write failed, reload restores the
      // call to the board so a customer's request is never silently dropped.
      await getSupabase()
        .from("waiter_calls")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
        .eq("id", callId);
      void reload();
    },
    [reload],
  );

  return { ...state, reload, setOrderStatus, acknowledgeCall };
}
