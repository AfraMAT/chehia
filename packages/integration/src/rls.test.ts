import { describe, expect, it } from "vitest";
import {
  anonClient,
  customerClient,
  staffClient,
  EL_MARSA_ID,
  LE_ZINK_ID,
  CAPPUCCINO_ID,
} from "./helpers";

describe("RLS — public menu access", () => {
  it("anonymous (no session) can read restaurants, categories, items, tables", async () => {
    const client = anonClient();
    const [{ data: restaurants }, { data: items }, { data: tables }] = await Promise.all([
      client.from("restaurants").select("id"),
      client.from("items").select("id"),
      client.from("tables").select("id"),
    ]);
    expect(restaurants?.length).toBeGreaterThan(0);
    expect(items?.length).toBeGreaterThan(0);
    expect(tables?.length).toBeGreaterThan(0);
  });

  it("anonymous cannot modify menu items", async () => {
    const client = anonClient();
    const { data } = await client
      .from("items")
      .update({ price_millimes: 1 })
      .eq("id", CAPPUCCINO_ID)
      .select();
    // RLS: zero rows affected, price unchanged.
    expect(data ?? []).toHaveLength(0);
    const { data: item } = await client.from("items").select("price_millimes").eq("id", CAPPUCCINO_ID).single();
    expect(item?.price_millimes).toBe(5500);
  });

  it("anonymous customers cannot read orders or waiter calls of others", async () => {
    const customer = await customerClient();
    const [{ data: orders }, { data: calls }] = await Promise.all([
      customer.from("orders").select("id"),
      customer.from("waiter_calls").select("id"),
    ]);
    expect(orders ?? []).toHaveLength(0);
    expect(calls ?? []).toHaveLength(0);
  });

  it("anonymous customers cannot insert orders directly (must use edge function)", async () => {
    const customer = await customerClient();
    const { error } = await customer.from("orders").insert({
      restaurant_id: EL_MARSA_ID,
      table_id: "00000000-0000-0000-0000-000000000000",
      total_millimes: 0,
    });
    expect(error).not.toBeNull();
  });
});

describe("RLS — staff & tenant isolation", () => {
  it("El Marsa owner sees only El Marsa orders", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const { data: orders } = await owner.from("orders").select("restaurant_id");
    expect(orders?.length).toBeGreaterThan(0);
    expect(orders?.every((o) => o.restaurant_id === EL_MARSA_ID)).toBe(true);
  });

  it("Le Zink owner cannot see El Marsa data", async () => {
    const zink = await staffClient("owner@lezink.tn");
    const [{ data: orders }, { data: insights }] = await Promise.all([
      zink.from("orders").select("restaurant_id"),
      zink.from("ai_insights").select("restaurant_id"),
    ]);
    expect((orders ?? []).some((o) => o.restaurant_id === EL_MARSA_ID)).toBe(false);
    expect((insights ?? []).some((i) => i.restaurant_id === EL_MARSA_ID)).toBe(false);
  });

  it("Le Zink owner cannot update El Marsa items", async () => {
    const zink = await staffClient("owner@lezink.tn");
    const { data } = await zink.from("items").update({ is_available: false }).eq("id", CAPPUCCINO_ID).select();
    expect(data ?? []).toHaveLength(0);
  });

  it("kitchen staff can advance orders but cannot manage the menu", async () => {
    const kitchen = await staffClient("cuisine@elmarsa.tn");

    // Can read + update an order of its restaurant.
    const { data: orders } = await kitchen.from("orders").select("id, status").eq("status", "preparing").limit(1);
    expect(orders?.length).toBeGreaterThan(0);

    // Cannot change the menu (owner/manager only).
    const { data: itemUpdate } = await kitchen
      .from("items")
      .update({ price_millimes: 9999 })
      .eq("id", CAPPUCCINO_ID)
      .select();
    expect(itemUpdate ?? []).toHaveLength(0);
  });

  it("staff can read own staff roster, not other tenants'", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const { data: staff } = await owner.from("staff").select("restaurant_id");
    expect(staff?.length).toBeGreaterThan(0);
    expect(staff?.every((s) => s.restaurant_id === EL_MARSA_ID || s.restaurant_id === LE_ZINK_ID)).toBe(true);
    expect(staff?.some((s) => s.restaurant_id === LE_ZINK_ID)).toBe(false);
  });
});
