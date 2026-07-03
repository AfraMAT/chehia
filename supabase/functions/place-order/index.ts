// place-order: the only write path for customer orders.
// - Caller must be an authenticated Supabase user (anonymous auth is fine).
// - Table is identified by its qr_token (the capability printed in the QR) OR,
//   for customers who arrived via discovery (app.chehia.app) and picked their
//   table, by table_id. Either way the table + venue are re-validated here.
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
  /** Scanned flow: the QR token printed at the table. */
  qr_token?: string;
  /** Discovery flow: a table chosen from list_venue_tables (no token needed). */
  table_id?: string;
  language?: string;
  note?: string;
  /** Client-generated idempotency key: retries never duplicate an order. */
  client_ref?: string;
  lines: OrderLineInput[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  if ((!input?.qr_token && !input?.table_id) || !Array.isArray(input.lines) || input.lines.length === 0) {
    return errorResponse("bad_request", "a table (qr_token or table_id) and at least one line are required");
  }
  if (input.table_id && !UUID_RE.test(input.table_id)) {
    return errorResponse("bad_request", "table_id must be a UUID");
  }
  if (input.lines.length > 50) {
    return errorResponse("too_many_lines", "Order too large");
  }
  for (const line of input.lines) {
    if (!line.item_id || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 20) {
      return errorResponse("bad_line", "Each line needs item_id and qty between 1 and 20");
    }
  }

  // Resolve the table by its QR token (scanned flow) or its id (chosen from the
  // discovery table picker). Either way the venue's is_active is re-checked below.
  const tableQuery = admin
    .from("tables")
    .select("id, restaurant_id, label, zone, is_active");
  const { data: table } = await (input.qr_token
    ? tableQuery.eq("qr_token", input.qr_token)
    : tableQuery.eq("id", input.table_id!)
  ).maybeSingle();
  if (!table || !table.is_active) {
    return errorResponse("unknown_table", "This table is not valid", 404);
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, is_active, require_qr")
    .eq("id", table.restaurant_id)
    .maybeSingle();
  if (!restaurant?.is_active) {
    return errorResponse("restaurant_inactive", "This venue is not taking orders", 409);
  }

  // Scanned (qr_token) vs remote browse (table_id chosen from discovery).
  const origin = input.qr_token ? "scan" : "browse";
  // A venue may switch off remote ordering entirely (only scanned QR accepted).
  if (origin === "browse" && restaurant.require_qr) {
    return errorResponse("qr_required", "This venue requires scanning the table's QR code to order", 403);
  }

  // Abuse controls — bound how fast a single session or a single table can
  // create orders (defence-in-depth on top of place_order_tx's open-order cap).
  {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= 6) {
      return errorResponse("rate_limited", "Too many recent orders — please wait a moment", 429);
    }
  }
  {
    const since = new Date(Date.now() - 90_000).toISOString();
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("table_id", table.id)
      .gte("created_at", since);
    if ((count ?? 0) >= 4) {
      return errorResponse("rate_limited", "Several very recent orders on this table — please wait", 429);
    }
  }

  // Load items + their modifier structure for validation and pricing.
  const itemIds = [...new Set(input.lines.map((l) => l.item_id))];
  const { data: items, error: itemsErr } = await admin
    .from("items")
    .select("id, restaurant_id, name_i18n, price_millimes, is_available")
    .in("id", itemIds);
  if (itemsErr) {
    console.error("place-order items query failed:", itemsErr);
    return errorResponse("db_error", "Could not load the menu", 500);
  }

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

    const unitPrice = item.price_millimes + delta;
    if (unitPrice < 0) {
      // Negative modifier deltas may not drive a line below zero.
      return errorResponse("modifier_invalid", "Selected options produce an invalid price");
    }
    pricedLines.push({
      item_id: line.item_id,
      name_snapshot: item.name_i18n,
      qty: line.qty,
      unit_price_millimes: unitPrice,
      modifiers_snapshot: snapshot,
      note: (line.note ?? "").slice(0, 500),
    });
  }

  const total = pricedLines.reduce((sum, l) => sum + l.unit_price_millimes * l.qty, 0);
  const clientRef = input.client_ref && UUID_RE.test(input.client_ref) ? input.client_ref : null;

  // Atomic insert (order + items in one transaction) with a per-tenant
  // order number, idempotency on client_ref, and an open-order cap.
  const { data: order, error: txError } = await admin.rpc("place_order_tx", {
    p_restaurant_id: table.restaurant_id,
    p_table_id: table.id,
    p_note: (input.note ?? "").slice(0, 500),
    p_language: ["fr", "ar", "en"].includes(input.language ?? "") ? input.language : "fr",
    p_total_millimes: total,
    p_created_by: userId,
    p_client_ref: clientRef,
    p_lines: pricedLines,
  });
  if (txError || !order) {
    if (txError?.message?.includes("too_many_open_orders")) {
      return errorResponse("too_many_open_orders", "Too many open orders for this session", 429);
    }
    console.error("place-order tx failed:", txError);
    return errorResponse("db_error", "Could not create the order", 500);
  }

  // Tag remote (browse) orders so staff can distinguish them from scanned ones.
  // Scanned orders keep the column default ('scan'); only browse needs a write.
  if (origin === "browse") {
    await admin.from("orders").update({ origin }).eq("id", order.id);
  }

  return jsonResponse({
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_millimes: order.total_millimes,
      created_at: order.created_at,
      duplicate: order.duplicate ?? false,
      table_label: table.label,
      table_zone: table.zone,
    },
  });
});
