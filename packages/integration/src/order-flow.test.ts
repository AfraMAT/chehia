import { describe, expect, it } from "vitest";
import {
  callFunction,
  customerClient,
  staffClient,
  anonClient,
  CAPPUCCINO_ID,
  EXPRESS_ID,
  ICED_COFFEE_ID,
  SIZE_L,
  SIZE_S,
  SUGAR_NONE,
  EXTRA_SHOT,
  T12_TOKEN,
} from "./helpers";

describe("place-order edge function", () => {
  it("rejects unauthenticated calls", async () => {
    const { status } = await callFunction(anonClient(), "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: EXPRESS_ID, qty: 1 }],
    });
    expect(status).toBe(401);
  });

  it("rejects an unknown table token", async () => {
    const customer = await customerClient();
    const { status, json } = await callFunction(customer, "place-order", {
      qr_token: "not-a-real-token",
      lines: [{ item_id: EXPRESS_ID, qty: 1 }],
    });
    expect(status).toBe(404);
    expect(json.error.code).toBe("unknown_table");
  });

  it("rejects a missing required modifier (cappuccino size)", async () => {
    const customer = await customerClient();
    const { status, json } = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: CAPPUCCINO_ID, qty: 1, modifier_ids: [] }],
    });
    expect(status).toBe(400);
    expect(json.error.code).toBe("missing_required_modifier");
  });

  it("rejects sold-out items", async () => {
    const customer = await customerClient();
    const { status, json } = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: ICED_COFFEE_ID, qty: 1 }],
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe("item_unavailable");
  });

  it("computes prices server-side and creates a readable, trackable order", async () => {
    const customer = await customerClient();
    const { status, json } = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      language: "fr",
      note: "test — sans sucre",
      lines: [
        // 2 × cappuccino L (5500 + 1800) + double shot (1200) = 2 × 8500 = 17000
        { item_id: CAPPUCCINO_ID, qty: 2, modifier_ids: [SIZE_L, SUGAR_NONE, EXTRA_SHOT] },
        // 1 × express 2800
        { item_id: EXPRESS_ID, qty: 1 },
      ],
    });
    expect(status).toBe(200);
    expect(json.order.total_millimes).toBe(2 * (5500 + 1800 + 1200) + 2800);
    expect(json.order.status).toBe("new");
    expect(json.order.table_label).toBe("12");

    // The customer can read (track) their own order under RLS.
    const { data: own } = await customer.from("orders").select("id, status, total_millimes").eq("id", json.order.id).single();
    expect(own?.total_millimes).toBe(json.order.total_millimes);

    // Another anonymous customer cannot see it.
    const other = await customerClient();
    const { data: foreign } = await other.from("orders").select("id").eq("id", json.order.id);
    expect(foreign ?? []).toHaveLength(0);

    // Staff can see and advance it through the lifecycle.
    const owner = await staffClient("owner@elmarsa.tn");
    const { data: advanced } = await owner
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", json.order.id)
      .select("status, accepted_at")
      .single();
    expect(advanced?.status).toBe("preparing");
    expect(advanced?.accepted_at).not.toBeNull();

    const { data: served } = await owner
      .from("orders")
      .update({ status: "served" })
      .eq("id", json.order.id)
      .select("status, served_at")
      .single();
    expect(served?.served_at).not.toBeNull();
  });

  it("rejects modifiers that belong to another item", async () => {
    const customer = await customerClient();
    const { status, json } = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: EXPRESS_ID, qty: 1, modifier_ids: [SIZE_S] }],
    });
    // Cross-item modifiers fall outside the ordered items' scope → rejected.
    expect([400, 409]).toContain(status);
    expect(["modifier_mismatch", "unknown_modifier"]).toContain(json.error.code);
  });

  it("rejects absurd quantities", async () => {
    const customer = await customerClient();
    const { status } = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: EXPRESS_ID, qty: 999 }],
    });
    expect(status).toBe(400);
  });
});

describe("call-waiter edge function", () => {
  it("creates a call and throttles a second one for the same table", async () => {
    const customer = await customerClient();

    const first = await callFunction(customer, "call-waiter", {
      qr_token: T12_TOKEN,
      reason: "bill",
    });
    expect(first.status).toBe(200);
    expect(first.json.call.id).toBeTruthy();

    const second = await callFunction(customer, "call-waiter", {
      qr_token: T12_TOKEN,
      reason: "water",
    });
    expect(second.status).toBe(200);
    expect(second.json.call.already_open).toBe(true);

    // Staff acknowledges to clean up.
    const owner = await staffClient("owner@elmarsa.tn");
    await owner.from("waiter_calls").update({ status: "acknowledged" }).eq("id", first.json.call.id);
  });

  it("rejects unknown tokens", async () => {
    const customer = await customerClient();
    const { status } = await callFunction(customer, "call-waiter", { qr_token: "bogus", reason: "bill" });
    expect(status).toBe(404);
  });
});
