import { describe, expect, it } from "vitest";
import {
  adminClient,
  callFunction,
  customerClient,
  EXPRESS_ID,
  T12_TOKEN,
} from "./helpers";

function uuid(): string {
  return crypto.randomUUID();
}

describe("place-order hardening", () => {
  it("is idempotent on client_ref: a retry returns the same order", async () => {
    const customer = await customerClient();
    const clientRef = uuid();
    const payload = {
      qr_token: T12_TOKEN,
      client_ref: clientRef,
      lines: [{ item_id: EXPRESS_ID, qty: 1 }],
    };

    const first = await callFunction(customer, "place-order", payload);
    expect(first.status).toBe(200);
    expect(first.json.order.duplicate).toBe(false);

    const second = await callFunction(customer, "place-order", payload);
    expect(second.status).toBe(200);
    expect(second.json.order.id).toBe(first.json.order.id);
    expect(second.json.order.duplicate).toBe(true);
  });

  it("assigns per-restaurant order numbers", async () => {
    const customer = await customerClient();
    const a = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: EXPRESS_ID, qty: 1 }],
    });
    const b = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: EXPRESS_ID, qty: 1 }],
    });
    const numberOf = (r: { json: { order: { order_number: string } } }) =>
      Number(r.json.order.order_number.replace("A-", ""));
    expect(numberOf(b)).toBe(numberOf(a) + 1);
  });

  it("orders and their lines commit atomically (lines exist immediately)", async () => {
    const customer = await customerClient();
    const { json } = await callFunction(customer, "place-order", {
      qr_token: T12_TOKEN,
      lines: [{ item_id: EXPRESS_ID, qty: 2 }],
    });
    const admin = adminClient();
    const { data: lines } = await admin.from("order_items").select("qty").eq("order_id", json.order.id);
    expect(lines).toHaveLength(1);
    expect(lines?.[0]?.qty).toBe(2);
  });

  it("caps open orders per customer session at 5", async () => {
    const customer = await customerClient();
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const { status } = await callFunction(customer, "place-order", {
        qr_token: T12_TOKEN,
        lines: [{ item_id: EXPRESS_ID, qty: 1 }],
      });
      results.push(status);
    }
    expect(results.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(results[5]).toBe(429);
  });
});

describe("analytics RPCs", () => {
  it("stats_summary respects RLS (staff sees own venue, anon denied by grant)", async () => {
    const { staffClient } = await import("./helpers");
    const owner = await staffClient("owner@elmarsa.tn");
    const { data, error } = await owner.rpc("stats_summary", {
      p_restaurant_id: "aaaaaaaa-0000-0000-0000-000000000001",
      p_days: 7,
    });
    expect(error).toBeNull();
    expect(data.order_count).toBeGreaterThan(0);
    expect(Array.isArray(data.top_items)).toBe(true);

    // Another tenant's owner sees zero through the same function (RLS).
    const zink = await staffClient("owner@lezink.tn");
    const { data: foreign } = await zink.rpc("stats_summary", {
      p_restaurant_id: "aaaaaaaa-0000-0000-0000-000000000001",
      p_days: 7,
    });
    expect(foreign?.order_count ?? 0).toBe(0);
  });

  it("insights_metrics is not callable by anon/authenticated", async () => {
    const customer = await customerClient();
    const { error } = await customer.rpc("insights_metrics", {
      p_restaurant_id: "aaaaaaaa-0000-0000-0000-000000000001",
      p_days: 7,
    });
    expect(error).not.toBeNull();
  });

  it("place_order_tx is not callable directly by clients", async () => {
    const customer = await customerClient();
    const { error } = await customer.rpc("place_order_tx", {
      p_restaurant_id: "aaaaaaaa-0000-0000-0000-000000000001",
      p_table_id: "00000000-0000-0000-0000-000000000000",
      p_note: "",
      p_language: "fr",
      p_total_millimes: 0,
      p_created_by: "00000000-0000-0000-0000-000000000000",
      p_client_ref: null,
      p_lines: [],
    });
    expect(error).not.toBeNull();
  });
});
