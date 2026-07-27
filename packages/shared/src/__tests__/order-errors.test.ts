import { describe, expect, it } from "vitest";
import { orderErrorMessage } from "../order-errors";
import { ar, en, fr } from "../i18n";

/**
 * Every error code `place-order` can return to a solo cart. If a new code is
 * added there without a case here, `mapsEverySolo…` fails — which is exactly
 * the regression that let the web cart answer "order failed" to a paused venue.
 */
const SOLO_CODES = [
  "item_unavailable",
  "unknown_item",
  "unknown_table",
  "qr_required",
  "restaurant_inactive",
  "ordering_paused",
  "venue_closed",
  "rate_limited",
  "too_many_open_orders",
  "too_many_lines",
  "bad_line",
  "bad_request",
  "too_many_modifiers",
  "modifier_invalid",
  "missing_required_modifier",
  "unknown_modifier",
  "modifier_mismatch",
  "dup_modifier",
  "auth_failed",
  "unauthorized",
  "location_required",
  "too_far",
  // Client-side, not from place-order: the mobile offline queue is single-slot.
  "queue_busy",
];

describe("orderErrorMessage", () => {
  it("maps every solo place-order code to something more useful than the fallback", () => {
    for (const code of SOLO_CODES) {
      expect(orderErrorMessage(code, fr), code).not.toBe(fr.errors.orderFailed);
    }
  });

  it("distinguishes the actionable failures a customer can actually resolve", () => {
    expect(orderErrorMessage("ordering_paused", fr)).toBe(fr.errors.venueClosed);
    expect(orderErrorMessage("venue_closed", fr)).toBe(fr.errors.venueClosed);
    expect(orderErrorMessage("qr_required", fr)).toBe(fr.errors.qrRequired);
    expect(orderErrorMessage("rate_limited", fr)).toBe(fr.errors.rateLimited);
    expect(orderErrorMessage("too_far", fr)).toBe(fr.location.gate.tooFar);
    expect(orderErrorMessage("item_unavailable", fr)).toBe(fr.cart.itemUnavailable);
  });

  it("falls back for db_error, unknown codes and a missing code", () => {
    expect(orderErrorMessage("db_error", fr)).toBe(fr.errors.orderFailed);
    expect(orderErrorMessage("something_new", fr)).toBe(fr.errors.orderFailed);
    expect(orderErrorMessage(undefined, fr)).toBe(fr.errors.orderFailed);
  });

  it("resolves in all three languages and never returns an empty string", () => {
    for (const dict of [fr, ar, en]) {
      for (const code of [...SOLO_CODES, "db_error", undefined]) {
        expect(orderErrorMessage(code, dict).length, `${code}`).toBeGreaterThan(0);
      }
    }
  });
});
