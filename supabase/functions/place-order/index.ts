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
  /** Who added this line (group ordering); snapshotted onto order_items. */
  participant_nickname?: string;
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
  /** Group ordering: place from a shared session instead of client-sent lines. */
  session_id?: string;
  /** "group" = the whole session (host only), "solo" = just my lines. */
  place_mode?: "group" | "solo";
  /** Browse flow only: the customer's device location, to prove presence. */
  customer_lat?: number;
  customer_lng?: number;
  /** The GPS reading's own accuracy in metres (widens the allowed radius). */
  customer_accuracy_m?: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kept in sync with @chehia/shared's geo.ts (edge functions can't import it).
const GEOFENCE_ACCURACY_SLACK_M = 100;
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000; // metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

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

  // Idempotency (all flows): a repeated client_ref returns the already-created
  // order. Checked up front so a group/solo retry never trips the session-state
  // guards below (the session is already closed after the first success).
  if (input.client_ref && UUID_RE.test(input.client_ref)) {
    const { data: existing } = await admin
      .from("orders")
      .select("id, order_number, status, total_millimes, created_at, table_id")
      .eq("client_ref", input.client_ref)
      .eq("created_by", userId)
      .maybeSingle();
    if (existing) {
      const { data: tb } = await admin.from("tables").select("label, zone").eq("id", existing.table_id).maybeSingle();
      return jsonResponse({
        order: {
          id: existing.id,
          order_number: existing.order_number,
          status: existing.status,
          total_millimes: existing.total_millimes,
          created_at: existing.created_at,
          duplicate: true,
          table_label: tb?.label ?? "",
          table_zone: tb?.zone ?? "",
        },
      });
    }
  }

  // Group ordering: build the order from a shared session's cart, server-side.
  let fromSession = false;
  let sessionId: string | null = null;
  let placeMode: "group" | "solo" | null = null;
  let participantId: string | null = null;
  if (input.session_id) {
    if (!UUID_RE.test(input.session_id)) return errorResponse("bad_request", "session_id must be a UUID");
    placeMode = input.place_mode === "group" ? "group" : "solo";

    const { data: session } = await admin
      .from("order_sessions")
      .select("id, table_id, restaurant_id, status")
      .eq("id", input.session_id)
      .maybeSingle();
    if (!session) return errorResponse("session_not_found", "Group order not found", 404);
    if (session.status !== "open") return errorResponse("session_closed", "This group order is no longer open", 409);

    const { data: me } = await admin
      .from("session_participants")
      .select("id, is_host")
      .eq("session_id", session.id)
      .eq("auth_uid", userId)
      .is("left_at", null)
      .maybeSingle();
    if (!me) return errorResponse("not_a_member", "You are not in this group order", 403);
    participantId = me.id;

    if (placeMode === "group") {
      if (!me.is_host) return errorResponse("host_only", "Only the host can place the group order", 403);
      const { data: parts } = await admin
        .from("session_participants")
        .select("is_ready")
        .eq("session_id", session.id)
        .is("left_at", null);
      if (!parts || parts.length === 0 || parts.some((p) => !p.is_ready)) {
        return errorResponse("not_ready", "Not everyone is ready yet", 409);
      }
    }

    let linesQuery = admin
      .from("session_cart_lines")
      .select("item_id, qty, modifier_ids, note, participant:session_participants(nickname)")
      .eq("session_id", session.id);
    if (placeMode === "solo") linesQuery = linesQuery.eq("participant_id", participantId);
    const { data: sessionLines } = await linesQuery;
    if (!sessionLines || sessionLines.length === 0) return errorResponse("empty_cart", "No items to order", 400);

    input.qr_token = undefined;
    input.table_id = session.table_id;
    input.lines = sessionLines.map((l) => ({
      item_id: l.item_id as string,
      qty: l.qty as number,
      modifier_ids: (l.modifier_ids as string[] | null) ?? [],
      note: (l.note as string | null) ?? "",
      participant_nickname: (l.participant as { nickname?: string } | null)?.nickname ?? "",
    }));
    fromSession = true;
    sessionId = session.id;
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
    .select("id, is_active, require_qr, require_location, geofence_radius_m, latitude, longitude")
    .eq("id", table.restaurant_id)
    .maybeSingle();
  if (!restaurant?.is_active) {
    return errorResponse("restaurant_inactive", "This venue is not taking orders", 409);
  }

  // Scanned (qr_token) vs remote browse (table_id chosen from discovery).
  // Group/solo session orders are always at a physical table → treat as scan.
  const origin = fromSession ? "scan" : input.qr_token ? "scan" : "browse";
  // A venue may switch off remote ordering entirely (only scanned QR accepted).
  if (origin === "browse" && restaurant.require_qr) {
    return errorResponse("qr_required", "This venue requires scanning the table's QR code to order", 403);
  }

  // Location gate (browse flow only): the customer must be within the venue's
  // geofence to order remotely, so people can't order when they aren't there.
  // Scanned-QR orders skip this (the QR already proves presence). Only enforced
  // when the venue opted in AND has a pin — otherwise there's nothing to check
  // against. The device coords are self-reported and therefore spoofable, so
  // this raises the bar for casual abuse rather than being a hard guarantee;
  // require_qr remains the strict option.
  if (
    origin === "browse" &&
    restaurant.require_location &&
    restaurant.latitude != null &&
    restaurant.longitude != null
  ) {
    const lat = Number(input.customer_lat);
    const lng = Number(input.customer_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return errorResponse("location_required", "Share your location to order from this venue", 403);
    }
    const radiusM = Math.min(5000, Math.max(20, Math.trunc(restaurant.geofence_radius_m ?? 200)));
    const slack = Math.min(GEOFENCE_ACCURACY_SLACK_M, Math.max(0, Number(input.customer_accuracy_m) || 0));
    const dist = distanceMeters(lat, lng, restaurant.latitude, restaurant.longitude);
    if (dist > radiusM + slack) {
      return errorResponse("too_far", "You must be at the venue to place this order", 403);
    }
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
  // Per-table burst limit — skipped for session orders, where a group and its
  // solo splits legitimately produce several near-simultaneous orders per table.
  if (!fromSession) {
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
    participant_nickname: string;
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
      participant_nickname: (line.participant_nickname ?? "").slice(0, 40),
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
    p_session_id: sessionId,
    p_place_mode: placeMode,
    p_participant_id: participantId,
  });
  if (txError || !order) {
    if (txError?.message?.includes("too_many_open_orders")) {
      return errorResponse("too_many_open_orders", "Too many open orders for this session", 429);
    }
    if (txError?.message?.includes("session_not_placeable")) {
      return errorResponse("session_closed", "This group order was already placed", 409);
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
