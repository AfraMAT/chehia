// place-order: the only write path for customer orders.
// - Caller must be an authenticated Supabase user (anonymous auth is fine).
// - Table is resolved from its qr_token (the capability printed in the QR).
// - Prices are recomputed from the database; client-sent prices are ignored.
// - Modifier selections are validated against group min/max rules.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

type OrderLineInput = {
  item_id: string;
  qty: number;
  modifier_ids?: string[];
  note?: string;
};

type PlaceOrderInput = {
  qr_token: string;
  language?: string;
  note?: string;
  lines: OrderLineInput[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify the caller from their JWT (anonymous customers included).
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return errorResponse("unauthorized", "Sign in (anonymously) before ordering", 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  let input: PlaceOrderInput;
  try {
    input = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }

  if (!input?.qr_token || !Array.isArray(input.lines) || input.lines.length === 0) {
    return errorResponse("bad_request", "qr_token and at least one line are required");
  }
  if (input.lines.length > 50) {
    return errorResponse("too_many_lines", "Order too large");
  }
  for (const line of input.lines) {
    if (!line.item_id || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 20) {
      return errorResponse("bad_line", "Each line needs item_id and qty between 1 and 20");
    }
  }

  // Resolve the table from its QR token.
  const { data: table } = await admin
    .from("tables")
    .select("id, restaurant_id, label, zone, is_active")
    .eq("qr_token", input.qr_token)
    .maybeSingle();
  if (!table || !table.is_active) {
    return errorResponse("unknown_table", "This QR code is not valid", 404);
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, is_active")
    .eq("id", table.restaurant_id)
    .maybeSingle();
  if (!restaurant?.is_active) {
    return errorResponse("restaurant_inactive", "This venue is not taking orders", 409);
  }

  // Load items + their modifier structure for validation and pricing.
  const itemIds = [...new Set(input.lines.map((l) => l.item_id))];
  const { data: items, error: itemsErr } = await admin
    .from("items")
    .select("id, restaurant_id, name_i18n, price_millimes, is_available")
    .in("id", itemIds);
  if (itemsErr) return errorResponse("db_error", itemsErr.message, 500);

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));
  for (const id of itemIds) {
    const item = itemById.get(id);
    if (!item || item.restaurant_id !== table.restaurant_id) {
      return errorResponse("unknown_item", `Item ${id} not found on this menu`, 404);
    }
    if (!item.is_available) {
      return errorResponse("item_unavailable", `Item ${id} is sold out`, 409);
    }
  }

  const { data: groups } = await admin
    .from("modifier_groups")
    .select("id, item_id, name_i18n, min_select, max_select")
    .in("item_id", itemIds);
  const { data: modifiers } = await admin
    .from("modifiers")
    .select("id, group_id, name_i18n, price_delta_millimes, is_available")
    .in("group_id", (groups ?? []).map((g) => g.id));

  const groupsByItem = new Map<string, NonNullable<typeof groups>>();
  for (const g of groups ?? []) {
    const list = groupsByItem.get(g.item_id) ?? [];
    list.push(g);
    groupsByItem.set(g.item_id, list);
  }
  const modifierById = new Map((modifiers ?? []).map((m) => [m.id, m]));

  // Validate each line's modifier selection and price it.
  type PricedLine = {
    item_id: string;
    name_snapshot: unknown;
    qty: number;
    unit_price_millimes: number;
    modifiers_snapshot: unknown[];
    note: string;
  };
  const pricedLines: PricedLine[] = [];

  for (const line of input.lines) {
    const item = itemById.get(line.item_id)!;
    const selected = line.modifier_ids ?? [];
    const seen = new Set<string>();
    let delta = 0;
    const snapshot: unknown[] = [];
    const countByGroup = new Map<string, number>();

    for (const modId of selected) {
      if (seen.has(modId)) return errorResponse("dup_modifier", "Duplicate modifier");
      seen.add(modId);
      const mod = modifierById.get(modId);
      if (!mod || !mod.is_available) {
        return errorResponse("unknown_modifier", `Modifier ${modId} not available`, 409);
      }
      const group = (groups ?? []).find((g) => g.id === mod.group_id);
      if (!group || group.item_id !== line.item_id) {
        return errorResponse("modifier_mismatch", "Modifier does not belong to this item");
      }
      countByGroup.set(group.id, (countByGroup.get(group.id) ?? 0) + 1);
      delta += mod.price_delta_millimes;
      snapshot.push({
        group: group.name_i18n,
        choice: mod.name_i18n,
        delta: mod.price_delta_millimes,
      });
    }

    for (const group of groupsByItem.get(line.item_id) ?? []) {
      const count = countByGroup.get(group.id) ?? 0;
      if (count < group.min_select) {
        return errorResponse(
          "missing_required_modifier",
          `A required choice is missing for ${JSON.stringify(item.name_i18n)}`,
        );
      }
      if (count > group.max_select) {
        return errorResponse("too_many_modifiers", "Too many options selected");
      }
    }

    pricedLines.push({
      item_id: line.item_id,
      name_snapshot: item.name_i18n,
      qty: line.qty,
      unit_price_millimes: item.price_millimes + delta,
      modifiers_snapshot: snapshot,
      note: (line.note ?? "").slice(0, 500),
    });
  }

  const total = pricedLines.reduce((sum, l) => sum + l.unit_price_millimes * l.qty, 0);

  // Insert order, then items; roll the order back if items fail.
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      restaurant_id: table.restaurant_id,
      table_id: table.id,
      status: "new",
      note: (input.note ?? "").slice(0, 500),
      language: ["fr", "ar", "en"].includes(input.language ?? "") ? input.language : "fr",
      total_millimes: total,
      created_by: userId,
    })
    .select("id, order_number, status, total_millimes, created_at")
    .single();
  if (orderErr || !order) {
    return errorResponse("db_error", orderErr?.message ?? "Could not create order", 500);
  }

  const { error: linesErr } = await admin.from("order_items").insert(
    pricedLines.map((l) => ({ ...l, order_id: order.id, restaurant_id: table.restaurant_id })),
  );
  if (linesErr) {
    await admin.from("orders").delete().eq("id", order.id);
    return errorResponse("db_error", linesErr.message, 500);
  }

  return jsonResponse({
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_millimes: order.total_millimes,
      created_at: order.created_at,
      table_label: table.label,
      table_zone: table.zone,
    },
  });
});
