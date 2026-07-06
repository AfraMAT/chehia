import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  customerClient,
  staffClient,
  EL_MARSA_ID,
  LE_ZINK_ID,
} from "./helpers";

const CAFE_CATEGORY = "cccccccc-0000-0000-0000-000000000001"; // El Marsa "Cafés"

const admin = adminClient();

// Fresh, isolated stock product for a test; cleaned up in afterAll.
const created: string[] = []; // inventory_item ids
const createdItems: string[] = []; // menu item ids
const createdOrders: string[] = []; // order ids

async function makeInventory(fields: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin
    .from("inventory_items")
    .insert({ restaurant_id: EL_MARSA_ID, name: `TEST ${crypto.randomUUID().slice(0, 8)}`, ...fields })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  created.push(data.id as string);
  return data.id as string;
}

async function makeMenuItem(): Promise<string> {
  const { data, error } = await admin
    .from("items")
    .insert({
      restaurant_id: EL_MARSA_ID,
      category_id: CAFE_CATEGORY,
      name_i18n: { fr: "TEST plat" },
      price_millimes: 5000,
      is_available: true,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  createdItems.push(data.id as string);
  return data.id as string;
}

async function firstTableId(): Promise<string> {
  const { data } = await admin.from("tables").select("id").eq("restaurant_id", EL_MARSA_ID).limit(1).single();
  return data!.id as string;
}

afterAll(async () => {
  if (createdOrders.length) await admin.from("orders").delete().in("id", createdOrders);
  if (createdItems.length) await admin.from("items").delete().in("id", createdItems);
  if (created.length) await admin.from("inventory_items").delete().in("id", created);
});

describe("inventory — RLS & isolation", () => {
  it("anonymous cannot read inventory, movements, or item_ingredients", async () => {
    const anon = anonClient();
    const [{ data: inv }, { data: mv }, { data: ing }] = await Promise.all([
      anon.from("inventory_items").select("id"),
      anon.from("stock_movements").select("id"),
      anon.from("item_ingredients").select("id"),
    ]);
    expect(inv ?? []).toHaveLength(0);
    expect(mv ?? []).toHaveLength(0);
    expect(ing ?? []).toHaveLength(0);
  });

  it("El Marsa staff read only their own venue's inventory", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const { data } = await owner.from("inventory_items").select("restaurant_id");
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((r) => r.restaurant_id === EL_MARSA_ID)).toBe(true);
  });

  it("Le Zink owner cannot see El Marsa inventory", async () => {
    const zink = await staffClient("owner@lezink.tn");
    const { data } = await zink.from("inventory_items").select("id").eq("restaurant_id", EL_MARSA_ID);
    expect(data ?? []).toHaveLength(0);
  });

  it("staff cannot insert into the stock_movements ledger directly (append-only)", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const id = await makeInventory({ qty_on_hand: 5, reorder_threshold: 2 });
    const { error } = await owner.from("stock_movements").insert({
      restaurant_id: EL_MARSA_ID,
      inventory_item_id: id,
      type: "adjustment",
      qty_delta: 100,
      qty_after: 105,
    });
    expect(error).not.toBeNull();
  });
});

describe("inventory — write RPCs (owner/manager only)", () => {
  it("kitchen staff cannot record a movement", async () => {
    const kitchen = await staffClient("cuisine@elmarsa.tn");
    const id = await makeInventory({ qty_on_hand: 5, reorder_threshold: 2 });
    const { error } = await kitchen.rpc("record_stock_movement", {
      p_item_id: id,
      p_type: "receive",
      p_qty: 3,
    });
    expect(error).not.toBeNull();
  });

  it("another tenant cannot move an El Marsa product (cross-tenant guard)", async () => {
    const zink = await staffClient("owner@lezink.tn");
    const id = await makeInventory({ qty_on_hand: 5, reorder_threshold: 2 });
    const { error } = await zink.rpc("record_stock_movement", { p_item_id: id, p_type: "receive", p_qty: 3 });
    expect(error).not.toBeNull();
  });

  it("owner receives stock: quantity rises and a movement is logged", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const id = await makeInventory({ qty_on_hand: 5, reorder_threshold: 2, unit: "kg" });
    const { data, error } = await owner.rpc("record_stock_movement", {
      p_item_id: id,
      p_type: "receive",
      p_qty: 4.5,
      p_reason: "delivery",
      p_unit_cost: 3000,
    });
    expect(error).toBeNull();
    expect(Number((data as { qty_on_hand: number }).qty_on_hand)).toBeCloseTo(9.5, 3);

    const { data: row } = await owner.from("inventory_items").select("qty_on_hand, unit_cost_millimes").eq("id", id).single();
    expect(Number(row!.qty_on_hand)).toBeCloseTo(9.5, 3);
    expect(row!.unit_cost_millimes).toBe(3000);

    const { data: mv } = await owner.from("stock_movements").select("type, qty_delta").eq("inventory_item_id", id);
    expect(mv?.some((m) => m.type === "receive" && Number(m.qty_delta) === 4.5)).toBe(true);
  });

  it("set_stock_count sets the on-hand and logs the signed difference", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const id = await makeInventory({ qty_on_hand: 10, reorder_threshold: 2 });
    const { error } = await owner.rpc("set_stock_count", { p_item_id: id, p_new_qty: 7, p_reason: "inventaire" });
    expect(error).toBeNull();
    const { data: row } = await owner.from("inventory_items").select("qty_on_hand").eq("id", id).single();
    expect(Number(row!.qty_on_hand)).toBeCloseTo(7, 3);
    const { data: mv } = await owner.from("stock_movements").select("type, qty_delta").eq("inventory_item_id", id).eq("type", "count").single();
    expect(Number(mv!.qty_delta)).toBeCloseTo(-3, 3);
  });

  it("crossing the threshold raises exactly one low-stock notification (and re-arms after recovery)", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const id = await makeInventory({ qty_on_hand: 10, reorder_threshold: 5 });

    // 10 → 4 : crosses into low.
    await owner.rpc("record_stock_movement", { p_item_id: id, p_type: "waste", p_qty: 6 });
    let { data: notifs } = await owner.from("notifications").select("type").eq("inventory_item_id", id);
    expect(notifs?.filter((n) => n.type === "stock_low").length).toBe(1);

    // 4 → 3 : still low, no new alert (edge-triggered).
    await owner.rpc("record_stock_movement", { p_item_id: id, p_type: "waste", p_qty: 1 });
    ({ data: notifs } = await owner.from("notifications").select("type").eq("inventory_item_id", id));
    expect(notifs?.filter((n) => n.type === "stock_low").length).toBe(1);

    // Recover to ok, then dip again → a fresh alert.
    await owner.rpc("record_stock_movement", { p_item_id: id, p_type: "receive", p_qty: 20 });
    await owner.rpc("set_stock_count", { p_item_id: id, p_new_qty: 2 });
    ({ data: notifs } = await owner.from("notifications").select("type").eq("inventory_item_id", id));
    expect(notifs?.filter((n) => n.type === "stock_low").length).toBe(2);
  });
});

describe("inventory — auto-depletion & restock", () => {
  let customerId: string;
  let tableId: string;

  beforeAll(async () => {
    const customer = await customerClient();
    const { data } = await customer.auth.getUser();
    customerId = data.user!.id;
    tableId = await firstTableId();
  });

  async function placeOrder(itemId: string, qty: number, unitPrice = 5000): Promise<string> {
    const { data, error } = await admin.rpc("place_order_tx", {
      p_restaurant_id: EL_MARSA_ID,
      p_table_id: tableId,
      p_note: "",
      p_language: "fr",
      p_total_millimes: unitPrice * qty,
      p_created_by: customerId,
      p_client_ref: null,
      p_lines: [
        {
          item_id: itemId,
          name_snapshot: { fr: "TEST" },
          qty,
          unit_price_millimes: unitPrice,
          modifiers_snapshot: [],
          note: "",
        },
      ],
    });
    if (error || !data) throw error ?? new Error("order failed");
    const orderId = (data as { id: string }).id;
    createdOrders.push(orderId);
    return orderId;
  }

  it("placing an order depletes linked stock; cancelling returns it", async () => {
    const invId = await makeInventory({ qty_on_hand: 10, reorder_threshold: 3, unit: "kg" });
    const menuId = await makeMenuItem();
    await admin.from("item_ingredients").insert({
      restaurant_id: EL_MARSA_ID,
      item_id: menuId,
      inventory_item_id: invId,
      qty_per_unit: 1.5,
    });

    // Order 2 → consumes 3.0 → 7.0 remaining.
    const orderId = await placeOrder(menuId, 2);
    let { data: row } = await admin.from("inventory_items").select("qty_on_hand").eq("id", invId).single();
    expect(Number(row!.qty_on_hand)).toBeCloseTo(7, 3);
    const { data: saleMv } = await admin.from("stock_movements").select("type, order_id, qty_delta").eq("inventory_item_id", invId).eq("type", "sale").single();
    expect(saleMv!.order_id).toBe(orderId);
    expect(Number(saleMv!.qty_delta)).toBeCloseTo(-3, 3);

    // Cancel → stock returns to 10.0, cancel_return movement logged.
    await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    ({ data: row } = await admin.from("inventory_items").select("qty_on_hand").eq("id", invId).single());
    expect(Number(row!.qty_on_hand)).toBeCloseTo(10, 3);
    const { data: ret } = await admin.from("stock_movements").select("qty_delta").eq("inventory_item_id", invId).eq("type", "cancel_return").single();
    expect(Number(ret!.qty_delta)).toBeCloseTo(3, 3);
  });

  it("an order never fails even if a linked product would go negative (oversell is allowed + alerted)", async () => {
    const invId = await makeInventory({ qty_on_hand: 1, reorder_threshold: 2 });
    const menuId = await makeMenuItem();
    await admin.from("item_ingredients").insert({ restaurant_id: EL_MARSA_ID, item_id: menuId, inventory_item_id: invId, qty_per_unit: 1 });

    const orderId = await placeOrder(menuId, 5); // needs 5, only 1 on hand
    expect(orderId).toBeTruthy();
    const { data: row } = await admin.from("inventory_items").select("qty_on_hand").eq("id", invId).single();
    expect(Number(row!.qty_on_hand)).toBeCloseTo(-4, 3);
    // Went out of stock → a stock_out notification exists.
    const { data: notifs } = await admin.from("notifications").select("type").eq("inventory_item_id", invId);
    expect(notifs?.some((n) => n.type === "stock_out")).toBe(true);
  });

  it("auto-86 hides linked dishes at zero and restores them on restock", async () => {
    const invId = await makeInventory({ qty_on_hand: 1, reorder_threshold: 0, auto_86: true });
    const menuId = await makeMenuItem();
    await admin.from("item_ingredients").insert({ restaurant_id: EL_MARSA_ID, item_id: menuId, inventory_item_id: invId, qty_per_unit: 1 });

    // Deplete to zero → dish auto-marked unavailable.
    await placeOrder(menuId, 1);
    let { data: item } = await admin.from("items").select("is_available").eq("id", menuId).single();
    expect(item!.is_available).toBe(false);

    // Restock above zero → dish available again.
    const owner = await staffClient("owner@elmarsa.tn");
    await owner.rpc("record_stock_movement", { p_item_id: invId, p_type: "receive", p_qty: 5 });
    ({ data: item } = await admin.from("items").select("is_available").eq("id", menuId).single());
    expect(item!.is_available).toBe(true);
  });
});

describe("inventory — onboarding stock setup", () => {
  // Mirrors StockStep.applyBalance: create at threshold 0 → count the opening
  // balance → set the real threshold via a plain update + reset the alert
  // baseline. Must NOT raise a low/out notification during setup, even when the
  // opening balance is at or below the chosen threshold.
  it("setting an opening balance below the threshold raises NO alert", async () => {
    const owner = await staffClient("owner@elmarsa.tn");
    const { data: inv } = await owner
      .from("inventory_items")
      .insert({ restaurant_id: EL_MARSA_ID, name: `TEST onb ${crypto.randomUUID().slice(0, 6)}`, category: "food", unit: "piece", reorder_threshold: 0, track: true })
      .select("id")
      .single();
    const id = inv!.id as string;
    created.push(id);

    // opening 3 while threshold is still 0 → level 'ok', no alert.
    const { error: countErr } = await owner.rpc("set_stock_count", { p_item_id: id, p_new_qty: 3, p_reason: "opening" });
    expect(countErr).toBeNull();
    // now set the real threshold (5) via a plain update — no movement, no alert.
    await owner.from("inventory_items").update({ reorder_threshold: 5, last_alert_level: "ok" }).eq("id", id);

    const { data: row } = await owner.from("inventory_items").select("qty_on_hand, reorder_threshold").eq("id", id).single();
    expect(Number(row!.qty_on_hand)).toBe(3);
    expect(Number(row!.reorder_threshold)).toBe(5);

    // The product is genuinely "low" (3 <= 5) but setup created zero alerts.
    const { data: notifs } = await owner.from("notifications").select("id").eq("inventory_item_id", id);
    expect(notifs ?? []).toHaveLength(0);
  });

  it("the onboarding source-guard cannot delete a real (source NULL) product", async () => {
    // A real shared ingredient with unit 'piece' (the exact shape a naive guard
    // would mistake for an auto-created dish product). The wizard's toggle-OFF
    // delete is scoped to source='onboarding_dish', so it must NOT remove this.
    const owner = await staffClient("owner@elmarsa.tn");
    const { data: inv } = await owner
      .from("inventory_items")
      .insert({ restaurant_id: EL_MARSA_ID, name: "TEST shared eggs", unit: "piece", reorder_threshold: 0, track: true })
      .select("id")
      .single();
    const id = inv!.id as string;
    created.push(id);
    // Simulate the onboarding untrack delete (guarded by source).
    await owner.from("inventory_items").delete().eq("id", id).eq("source", "onboarding_dish");
    const { data: still } = await owner.from("inventory_items").select("id, source").eq("id", id);
    expect(still ?? []).toHaveLength(1); // real product survives
    expect(still![0].source).toBeNull();
  });

  it("a piece product created for a dish links 1:1 so each sale deducts one", async () => {
    // This is the exact shape StockStep produces; the depletion path is covered
    // above, here we assert the link shape the onboarding step relies on.
    const owner = await staffClient("owner@elmarsa.tn");
    const { data: inv } = await owner
      .from("inventory_items")
      .insert({ restaurant_id: EL_MARSA_ID, name: "TEST dish product", category: "food", unit: "piece", reorder_threshold: 0, track: true })
      .select("id")
      .single();
    const invId = inv!.id as string;
    created.push(invId);
    const { error } = await owner
      .from("item_ingredients")
      .insert({ restaurant_id: EL_MARSA_ID, item_id: "dddddddd-0000-0000-0000-000000000006", inventory_item_id: invId, qty_per_unit: 1 });
    expect(error).toBeNull();
    const { data: link } = await owner.from("item_ingredients").select("qty_per_unit").eq("inventory_item_id", invId).single();
    expect(Number(link!.qty_per_unit)).toBe(1);
    // clean the link so it doesn't linger on the seeded Thé à la menthe dish.
    await owner.from("item_ingredients").delete().eq("inventory_item_id", invId);
  });
});

describe("inventory — notifications RLS", () => {
  it("staff read + mark-read their venue feed; other tenants cannot", async () => {
    // Ensure at least one notification exists for El Marsa (seed has low/out items).
    const owner = await staffClient("owner@elmarsa.tn");
    await owner.rpc("sync_stock_alerts", { p_restaurant_id: EL_MARSA_ID });

    const { data: mine } = await owner.from("notifications").select("id, restaurant_id");
    expect(mine?.length).toBeGreaterThan(0);
    expect(mine?.every((r) => r.restaurant_id === EL_MARSA_ID)).toBe(true);

    // Zink owner sees none of El Marsa's.
    const zink = await staffClient("owner@lezink.tn");
    const { data: theirs } = await zink.from("notifications").select("id").eq("restaurant_id", EL_MARSA_ID);
    expect(theirs ?? []).toHaveLength(0);

    // Mark-read works for own venue.
    const target = mine![0].id;
    const { data: upd } = await owner.from("notifications").update({ is_read: true }).eq("id", target).select("is_read").single();
    expect(upd!.is_read).toBe(true);
  });
});
