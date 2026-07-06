// submit-review: the only write path for customer ratings & reviews.
// - Caller must be an authenticated Supabase user (anonymous auth is fine).
// - The order must be SERVED, belong to the caller, and be within the
//   platform review window. The venue must have reviews enabled.
// - Reviews land `pending` (admin moderates) unless global config is 'auto'.
// - Idempotent + de-duplicated: a unique (order_id, item) index means a
//   resend never creates duplicate rows.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

type ItemRating = { item_id: string; rating: number; comment?: string };
type SubmitReviewInput = {
  order_id: string;
  /** Overall visit rating from the 😍/🙂/😐 face → 5/4/2. */
  venue?: { rating: number; sentiment?: "love" | "good" | "meh"; comment?: string };
  /** Per-dish 1–5 star ratings (optional, only the dishes the customer chose to rate). */
  items?: ItemRating[];
  /** Optional first name; blank renders as "Client". */
  name?: string;
  /** Client-generated idempotency key. */
  client_ref?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRating = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;

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
    return errorResponse("unauthorized", "Sign in before reviewing", 401);
  }
  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  let input: SubmitReviewInput;
  try {
    input = await req.json();
  } catch {
    return errorResponse("bad_json", "Invalid JSON body");
  }

  if (!input?.order_id || !UUID_RE.test(input.order_id)) {
    return errorResponse("bad_request", "order_id (UUID) is required");
  }
  const hasVenue = !!input.venue && isRating(input.venue.rating);
  const items = Array.isArray(input.items) ? input.items : [];
  if (!hasVenue && items.length === 0) {
    return errorResponse("bad_request", "Provide a visit rating and/or at least one dish rating");
  }
  if (items.length > 50) return errorResponse("too_many_items", "Too many item ratings");
  for (const it of items) {
    if (!it?.item_id || !UUID_RE.test(it.item_id) || !isRating(it.rating)) {
      return errorResponse("bad_item", "Each item rating needs item_id and rating 1–5");
    }
  }

  // Global config (singleton). Missing row → sensible defaults.
  const { data: cfg } = await admin
    .from("platform_reviews_config")
    .select("reviews_enabled, moderation_mode, allow_comments, max_comment_len, review_window_days")
    .maybeSingle();
  const reviewsEnabled = cfg?.reviews_enabled ?? true;
  const moderationMode = cfg?.moderation_mode ?? "manual";
  const allowComments = cfg?.allow_comments ?? true;
  const maxLen = cfg?.max_comment_len ?? 600;
  const windowDays = cfg?.review_window_days ?? 30;
  if (!reviewsEnabled || moderationMode === "disabled") {
    return errorResponse("reviews_disabled", "Reviews are currently turned off", 403);
  }

  // Load + validate the order: served, owned, in-window, on an enabled venue.
  const { data: order } = await admin
    .from("orders")
    .select("id, restaurant_id, status, created_by, served_at")
    .eq("id", input.order_id)
    .maybeSingle();
  if (!order) return errorResponse("unknown_order", "Order not found", 404);
  if (order.created_by !== userId) {
    return errorResponse("forbidden", "You can only review your own order", 403);
  }
  if (order.status !== "served") {
    return errorResponse("not_served", "You can review an order once it has been served", 409);
  }
  const servedAt = order.served_at ? new Date(order.served_at).getTime() : Date.now();
  if (Date.now() - servedAt > windowDays * 24 * 60 * 60_000) {
    return errorResponse("window_closed", "The review window for this order has passed", 409);
  }

  const { data: venueRow } = await admin
    .from("restaurants")
    .select("reviews_enabled")
    .eq("id", order.restaurant_id)
    .maybeSingle();
  if (!venueRow?.reviews_enabled) {
    return errorResponse("reviews_disabled", "This venue has turned off reviews", 403);
  }

  // Already reviewed? Idempotent success rather than an error.
  const { count: existing } = await admin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id)
    .eq("created_by", userId);
  if ((existing ?? 0) > 0) {
    return jsonResponse({ status: "already_reviewed", duplicate: true });
  }

  // Item ratings must reference dishes actually on this order.
  if (items.length > 0) {
    const { data: orderLines } = await admin
      .from("order_items")
      .select("item_id")
      .eq("order_id", order.id);
    const allowed = new Set((orderLines ?? []).map((l) => l.item_id).filter(Boolean));
    for (const it of items) {
      if (!allowed.has(it.item_id)) {
        return errorResponse("item_not_in_order", "You can only rate dishes from this order", 409);
      }
    }
  }

  const clean = (s: string | undefined) => (allowComments ? (s ?? "").toString().slice(0, maxLen) : "");
  const name = (input.name ?? "").toString().replace(/\s+/g, " ").trim().slice(0, 40);
  const status = moderationMode === "auto" ? "approved" : "pending";

  const venuePayload = hasVenue
    ? {
        rating: input.venue!.rating,
        // Validate against the enum allow-list: an unchecked value from the
        // request body would violate the reviews.sentiment CHECK constraint and
        // abort the whole tx as a 500. Coerce anything unexpected to null.
        sentiment:
          input.venue!.sentiment && (["love", "good", "meh"] as readonly string[]).includes(input.venue!.sentiment)
            ? input.venue!.sentiment
            : null,
        comment: clean(input.venue!.comment),
      }
    : null;
  const itemsPayload = items.map((it) => ({
    item_id: it.item_id,
    rating: it.rating,
    comment: clean(it.comment),
  }));
  const clientRef = input.client_ref && UUID_RE.test(input.client_ref) ? input.client_ref : null;

  const { data: result, error: txError } = await admin.rpc("place_review_tx", {
    p_restaurant_id: order.restaurant_id,
    p_order_id: order.id,
    p_created_by: userId,
    p_customer_name: name,
    p_status: status,
    p_client_ref: clientRef,
    p_venue: venuePayload,
    p_items: itemsPayload,
  });
  if (txError || !result) {
    console.error("submit-review tx failed:", txError);
    return errorResponse("db_error", "Could not save your review", 500);
  }

  return jsonResponse({ status, inserted: result.inserted ?? 0 });
});
