// register-order: the STAFF write path for the caisse (point-of-sale).
// The counter analog of place-order. Differences:
//   - Caller must be active staff of the table's venue (not just any auth user).
//   - Sets origin (counter/takeaway/staff_dine_in) + order_type + created_by_staff.
//   - No customer abuse caps (a busy counter legitimately fires many orders); the
//     hardened repricing + modifier validation are kept verbatim.
// Prices are always recomputed here — the tablet's math is never trusted.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

type OrderLineInput = {
  item_id: string;
  qty: number;
  modifier_ids?: string[];
  note?: string;
};

/** A line frozen at (offline) sale time — replayed as-is, never repriced. */
type CapturedLine = {
  item_id: string;
  qty: number;
  unit_price_millimes: number;
  name_snapshot?: unknown;
  modifiers_snapshot?: unknown[];
  note?: string;
};

type RegisterOrderInput = {
  table_id: string;
  /** dine_in | takeaway | walk_in (phone maps to walk_in for now) */
  order_type?: string;
  language?: string;
  note?: string;
  client_ref?: string;
  lines?: OrderLineInput[];
  /** Offline replay: honor the frozen prices the cash was collected at. */
  offline?: boolean;
  captured_lines?: CapturedLine[];
  captured_subtotal?: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// order_type → origin channel stamped on the order.
const ORIGIN_BY_TYPE: Record<string, string> = {
  walk_in: "counter",
  takeaway: "takeaway",
  dine_in: "staff_dine_in",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method_not_allowed", "POST only", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return errorResponse("unauthorized", "Sign in as staff before ringing up", 401);
  }
  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  // Caller must be active staff.
  const { data: staff } = await admin
    .from("staff")
    .select("id, restaurant_id, role, is_active")
    .eq("auth_uid", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff) {
    return errorResponse("not_staff", "This account is not staff of any venue", 403);
  }

  let input: RegisterOrderInput;
  try {
    input = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }

  const orderType = ["dine_in", "takeaway", "walk_in"].includes(input.order_type ?? "")
    ? input.order_type!
    : "walk_in";

  if (!input?.table_id || !UUID_RE.test(input.table_id)) {
    return errorResponse("bad_request", "table_id (UUID) is required");
  }

  const isReplay = input.offline === true && Array.isArray(input.captured_lines) && input.captured_lines.length > 0;
  if (isReplay) {
    if (input.captured_lines!.length > 100) {
      return errorResponse("too_many_lines", "Order too large");
    }
    for (const l of input.captured_lines!) {
      if (
        !l.item_id || !UUID_RE.test(l.item_id) ||
        !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 50 ||
        !Number.isInteger(l.unit_price_millimes) || l.unit_price_millimes < 0
      ) {
        return errorResponse("bad_line", "Invalid captured line");
      }
    }
  } else {
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      return errorResponse("bad_request", "at least one line is required");
    }
    if (input.lines.length > 100) {
      return errorResponse("too_many_lines", "Order too large");
    }
    for (const line of input.lines) {
      if (!line.item_id || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50) {
        return errorResponse("bad_line", "Each line needs item_id and qty between 1 and 50");
      }
    }
  }

  // Resolve the table and pin it to the caller's venue.
  const { data: table } = await admin
    .from("tables")
    .select("id, restaurant_id, label, zone, is_active")
    .eq("id", input.table_id)
    .maybeSingle();
  if (!table || !table.is_active) {
    return errorResponse("unknown_table", "This table is not valid", 404);
  }
  if (table.restaurant_id !== staff.restaurant_id) {
    return errorResponse("cross_tenant", "Table belongs to another venue", 403);
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, is_active")
    .eq("id", table.restaurant_id)
    .maybeSingle();
  if (!restaurant?.is_active) {
    return errorResponse("restaurant_inactive", "This venue is not active", 409);
  }

  type PricedLine = {
    item_id: string;
    name_snapshot: unknown;
    qty: number;
    unit_price_millimes: number;
    modifiers_snapshot: unknown[];
    note: string;
  };
  let pricedLines: PricedLine[] = [];
  let total = 0;

  if (isReplay) {
    // Offline replay: honor the FROZEN prices the cash was already collected at.
    // Never reprice from the live menu and never re-check availability — the sale
    // already happened; a menu/price edit must not change what the customer paid.
    pricedLines = input.captured_lines!.map((l) => ({
      item_id: l.item_id,
      name_snapshot: l.name_snapshot ?? {},
      qty: l.qty,
      unit_price_millimes: l.unit_price_millimes,
      modifiers_snapshot: Array.isArray(l.modifiers_snapshot) ? l.modifiers_snapshot : [],
      note: (l.note ?? "").slice(0, 500),
    }));
    total = Number.isInteger(input.captured_subtotal)
      ? input.captured_subtotal!
      : pricedLines.reduce((s, l) => s + l.unit_price_millimes * l.qty, 0);
  } else {
  // ---- Load items + modifier structure, then reprice server-side ----
  const itemIds = [...new Set(input.lines!.map((l) => l.item_id))];
  const { data: items, error: itemsErr } = await admin
    .from("items")
    .select("id, restaurant_id, name_i18n, price_millimes, is_available")
    .in("id", itemIds);
  if (itemsErr) {
    console.error("register-order items query failed:", itemsErr);
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

  for (const line of input.lines!) {
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
      snapshot.push({ group: group.name_i18n, choice: mod.name_i18n, delta: mod.price_delta_millimes });
    }

    for (const group of groupsByItem.get(line.item_id) ?? []) {
      const count = countByGroup.get(group.id) ?? 0;
      if (count < group.min_select) {
        return errorResponse("missing_required_modifier", `A required choice is missing for ${JSON.stringify(item.name_i18n)}`);
      }
      if (count > group.max_select) {
        return errorResponse("too_many_modifiers", "Too many options selected");
      }
    }

    const unitPrice = item.price_millimes + delta;
    if (unitPrice < 0) return errorResponse("modifier_invalid", "Selected options produce an invalid price");
    pricedLines.push({
      item_id: line.item_id,
      name_snapshot: item.name_i18n,
      qty: line.qty,
      unit_price_millimes: unitPrice,
      modifiers_snapshot: snapshot,
      note: (line.note ?? "").slice(0, 500),
    });
  }

    total = pricedLines.reduce((sum, l) => sum + l.unit_price_millimes * l.qty, 0);
  }

  const clientRef = input.client_ref && UUID_RE.test(input.client_ref) ? input.client_ref : null;

  const { data: order, error: txError } = await admin.rpc("register_order_tx", {
    p_restaurant_id: table.restaurant_id,
    p_table_id: table.id,
    p_note: (input.note ?? "").slice(0, 500),
    p_language: ["fr", "ar", "en"].includes(input.language ?? "") ? input.language : "fr",
    p_order_type: orderType,
    p_origin: ORIGIN_BY_TYPE[orderType] ?? "counter",
    p_subtotal_millimes: total,
    p_total_millimes: total,
    p_created_by: userId,
    p_created_by_staff: staff.id,
    p_client_ref: clientRef,
    p_lines: pricedLines,
  });
  if (txError || !order) {
    console.error("register-order tx failed:", txError);
    return errorResponse("db_error", "Could not create the order", 500);
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
