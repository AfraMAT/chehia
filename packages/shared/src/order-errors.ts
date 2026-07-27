import type { Dictionary } from "./i18n/fr";

/**
 * The error codes `supabase/functions/place-order` can hand back to a customer
 * placing a solo cart, mapped to copy from the shared dictionary.
 *
 * This lives here because web and mobile each used to keep their own table and
 * they drifted: mobile mapped ~20 codes while the web cart mapped 5, so a
 * paused venue, a closed venue, a rate-limited session or an invalid modifier
 * all told the web customer "the order could not be sent" with no way to act.
 * One table, both surfaces — add a code here when place-order emits a new one.
 *
 * Group-session codes (`session_closed`, `host_only`, `not_ready`) are handled
 * separately by the group cart against `t.group.*` and are deliberately absent.
 */
export function orderErrorMessage(code: string | undefined, t: Dictionary): string {
  if (!code) return t.errors.orderFailed;
  switch (code) {
    // Stale cart — the item vanished or sold out between browse and submit.
    case "item_unavailable":
    case "unknown_item":
      return t.cart.itemUnavailable;

    // The table itself is gone or was deactivated: re-scanning is the fix.
    case "unknown_table":
      return t.errors.unknownTable;

    // Venue opted out of remote ordering entirely.
    case "qr_required":
      return t.errors.qrRequired;

    // Venue not taking orders: inactive, owner-paused, or outside opening hours.
    case "restaurant_inactive":
    case "ordering_paused":
    case "venue_closed":
      return t.errors.venueClosed;

    // Abuse caps — per-session burst and per-table burst both surface as this.
    case "rate_limited":
      return t.errors.rateLimited;

    case "too_many_open_orders":
      return t.errors.tooManyOpenOrders;

    // Anything structurally wrong with the cart the customer can fix by
    // reviewing it: modifier rules, line caps, malformed lines.
    case "too_many_lines":
    case "bad_line":
    case "bad_request":
    case "too_many_modifiers":
    case "modifier_invalid":
    case "missing_required_modifier":
    case "unknown_modifier":
    case "modifier_mismatch":
    case "dup_modifier":
      return t.errors.orderInvalid;

    // Anonymous sign-in never completed, so the order was never authenticated.
    case "auth_failed":
    case "unauthorized":
      return t.errors.sessionFailed;

    // Client-side (mobile offline queue): one order is already waiting to send,
    // and the queue holds a single order per table. The cart is kept intact.
    case "queue_busy":
      return t.offline.alreadyQueued;

    // Location gate: the server re-checks presence even though the client
    // already gated the button, so reuse the gate's own copy.
    case "location_required":
      return t.location.gate.shareToOrder;
    case "too_far":
      return t.location.gate.tooFar;

    // db_error and anything unrecognised: generic, retryable.
    default:
      return t.errors.orderFailed;
  }
}
