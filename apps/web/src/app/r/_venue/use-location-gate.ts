"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_GEOFENCE_M,
  distanceMeters,
  withinGeofence,
  type Coords,
  type Restaurant,
} from "@chehia/shared";

/**
 * Location-gate state machine for the browse flow:
 * - idle:        haven't asked for the location yet
 * - locating:    waiting on the browser geolocation prompt/fix
 * - ok:          inside the venue geofence — ordering allowed
 * - far:         outside the geofence — ordering blocked (holds distanceM)
 * - denied:      the browser refused/failed the geolocation request
 * - unsupported: the browser has no geolocation API at all
 */
export type LocationGateState = "idle" | "locating" | "ok" | "far" | "denied" | "unsupported";

export interface LocationGate {
  /**
   * True only when the client-side gate should apply: the browse flow (no
   * qr_token — a scanned QR already proves presence), the venue requires being
   * on-site, and the venue has a map pin to measure against. When false the
   * app behaves exactly as before (no gate).
   */
  applies: boolean;
  state: LocationGateState;
  coords: Coords | null;
  /** Reported accuracy (m) of the last fix, used as geofence slack. */
  accuracy: number | null;
  /** Straight-line distance (m) from the customer to the venue pin, once known. */
  distanceM: number | null;
  /** Ask the browser for the customer's position and re-evaluate the gate. */
  request: () => void;
}

/** A minimal view of the current table — only the qr_token matters to the gate. */
type TableLike = { qr_token?: string } | null;

export function useLocationGate(restaurant: Restaurant, table: TableLike): LocationGate {
  const scanned = Boolean(table?.qr_token);
  const hasPin = restaurant.latitude != null && restaurant.longitude != null;
  const applies = !scanned && restaurant.require_location === true && hasPin;

  const [state, setState] = useState<LocationGateState>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);

  const { latitude: venueLat, longitude: venueLng, geofence_radius_m: radius } = restaurant;

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: Coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        const acc = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 0;
        setCoords(here);
        setAccuracy(acc);
        // No pin (shouldn't happen when `applies`): don't strand the customer.
        if (venueLat == null || venueLng == null) {
          setDistanceM(null);
          setState("ok");
          return;
        }
        const venue: Coords = { latitude: venueLat, longitude: venueLng };
        setDistanceM(distanceMeters(here, venue));
        setState(withinGeofence(here, venue, radius ?? DEFAULT_GEOFENCE_M, acc) ? "ok" : "far");
      },
      // Permission refused, position unavailable, or timeout — all recoverable
      // via retry, so they share the single "denied" UI.
      () => setState("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [venueLat, venueLng, radius]);

  return useMemo(
    () => ({ applies, state, coords, accuracy, distanceM, request }),
    [applies, state, coords, accuracy, distanceM, request],
  );
}
