// call-waiter: customer requests staff attention from their table.
// Same capability model as place-order: the table qr_token authorizes the call.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

const REASONS = ["bill", "water", "cutlery", "other"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "POST only", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return errorResponse("unauthorized", "Sign in (anonymously) first", 401);
  }

  let input: { qr_token?: string; reason?: string; note?: string };
  try {
    input = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }
  if (!input.qr_token) return errorResponse("bad_request", "qr_token required");
  const reason = REASONS.includes(input.reason as typeof REASONS[number])
    ? (input.reason as typeof REASONS[number])
    : "other";

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: table } = await admin
    .from("tables")
    .select("id, restaurant_id, label, is_active")
    .eq("qr_token", input.qr_token)
    .maybeSingle();
  if (!table || !table.is_active) {
    return errorResponse("unknown_table", "This QR code is not valid", 404);
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("is_active")
    .eq("id", table.restaurant_id)
    .maybeSingle();
  if (!restaurant?.is_active) {
    return errorResponse("restaurant_inactive", "This venue is not taking requests", 409);
  }

  const { data: call, error: callErr } = await admin
    .from("waiter_calls")
    .insert({
      restaurant_id: table.restaurant_id,
      table_id: table.id,
      reason,
      note: (input.note ?? "").slice(0, 300),
      created_by: userData.user.id,
    })
    .select("id, reason, status, created_at")
    .single();
  if (callErr) {
    // Unique partial index enforces one open call per table (race-safe).
    if (callErr.code === "23505") {
      const { data: existing } = await admin
        .from("waiter_calls")
        .select("id")
        .eq("table_id", table.id)
        .eq("status", "open")
        .maybeSingle();
      return jsonResponse({ call: { id: existing?.id, already_open: true } });
    }
    console.error("call-waiter insert failed:", callErr);
    return errorResponse("db_error", "Could not create the request", 500);
  }

  return jsonResponse({ call });
});
