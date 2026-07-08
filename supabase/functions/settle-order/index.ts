// settle-order: records payment against an order and stamps the fiscal receipt.
// Staff-only. Authority is the ORDER's own total + the venue's fiscal profile —
// the client's amounts are never trusted. The server computes: the timbre, the
// cash rounding, the amount actually collected, the change, and the TVA extracted
// from the (TTC) total. settle_order_tx then records it atomically + idempotently.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

type SettleInput = {
  order_id: string;
  method?: string; // cash | card | d17 | other
  tendered_millimes?: number;
  client_ref?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS = ["cash", "card", "d17", "other"];

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
    return errorResponse("unauthorized", "Sign in as staff before taking payment", 401);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: staff } = await admin
    .from("staff")
    .select("id, restaurant_id, is_active")
    .eq("auth_uid", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff) return errorResponse("not_staff", "This account is not staff of any venue", 403);

  let input: SettleInput;
  try {
    input = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }
  if (!input?.order_id || !UUID_RE.test(input.order_id)) {
    return errorResponse("bad_request", "order_id (UUID) is required");
  }
  const method = METHODS.includes(input.method ?? "") ? input.method! : "cash";
  const clientRef = input.client_ref && UUID_RE.test(input.client_ref) ? input.client_ref : null;

  // Load the order (authoritative total) + the venue's fiscal profile.
  const { data: order } = await admin
    .from("orders")
    .select("id, restaurant_id, total_millimes, paid_at")
    .eq("id", input.order_id)
    .maybeSingle();
  if (!order || order.restaurant_id !== staff.restaurant_id) {
    return errorResponse("unknown_order", "Order not found on this venue", 404);
  }

  const { data: fiscal } = await admin
    .from("restaurant_fiscal")
    .select("regime, tva_registered, default_tva_rate, timbre_millimes, cash_rounding_millimes")
    .eq("restaurant_id", staff.restaurant_id)
    .maybeSingle();

  const isReel = fiscal?.regime === "reel";
  const step = Math.max(0, Math.trunc(fiscal?.cash_rounding_millimes ?? 100));
  // Timbre + TVA apply only under the réel régime (forfaitaire = neither).
  const timbre = isReel ? Math.max(0, Math.trunc(fiscal?.timbre_millimes ?? 0)) : 0;
  const tvaRate = isReel && fiscal?.tva_registered ? Number(fiscal.default_tva_rate ?? 0) : 0;

  const total = order.total_millimes; // menu prices are TTC (tax-inclusive)
  const grossDue = total + timbre; // timbre is an added receipt line

  // Cash is rounded to the venue's step; other tenders pay the exact gross.
  let amount = grossDue;
  let rounding = 0;
  if (method === "cash" && step > 0) {
    amount = Math.round(grossDue / step) * step;
    // A coarse rounding step must never round a real sale down to nothing.
    if (amount === 0 && grossDue > 0) amount = grossDue;
    rounding = amount - grossDue;
  }

  // TVA extracted from the TTC total (informational on the receipt; forfait = 0).
  const tax = tvaRate > 0 ? Math.round(total - total / (1 + tvaRate / 100)) : 0;

  const tendered = method === "cash" && Number.isFinite(input.tendered_millimes)
    ? Math.max(0, Math.trunc(input.tendered_millimes!))
    : null;
  const change = tendered !== null ? Math.max(0, tendered - amount) : 0;

  const { data: result, error: txError } = await admin.rpc("settle_order_tx", {
    p_restaurant_id: staff.restaurant_id,
    p_order_id: order.id,
    p_method: method,
    p_amount_millimes: amount,
    p_tendered_millimes: tendered,
    p_change_millimes: change,
    p_tax_total_millimes: tax,
    p_timbre_millimes: timbre,
    p_rounding_millimes: rounding,
    p_created_by_staff: staff.id,
    p_client_ref: clientRef,
  });
  if (txError || !result) {
    console.error("settle-order tx failed:", txError);
    return errorResponse("db_error", "Could not record the payment", 500);
  }

  return jsonResponse({
    payment: {
      ...result,
      method,
      amount_millimes: amount,
      tendered_millimes: tendered,
      change_millimes: change,
      tax_total_millimes: tax,
      timbre_millimes: timbre,
      rounding_millimes: rounding,
    },
  });
});
