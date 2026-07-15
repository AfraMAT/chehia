import * as Location from "expo-location";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { clampGeofence, distanceMeters, withinGeofence, type Coords } from "@chehia/shared";

/**
 * Location-gate state (customer side). Mirrors the web behaviour: a remote
 * (browse) customer can only place an order when physically at the venue.
 *
 * - `idle`        nothing requested yet
 * - `locating`    permission + position read in flight
 * - `ok`          within the venue's geofence — ordering allowed
 * - `far`         outside the geofence (carries `distanceM`)
 * - `denied`      the OS location permission was refused (asking again is possible)
 * - `blocked`     permanently refused — only the OS Settings screen can undo it
 * - `unsupported` the position read failed / native module unavailable
 */
export type LocationGateStatus = "idle" | "locating" | "ok" | "far" | "denied" | "blocked" | "unsupported";

export interface LocationGateValue {
  /** True only in the browse flow of a venue that requires location AND has a pin. */
  applies: boolean;
  status: LocationGateStatus;
  /** Customer position from the last successful read; null until located. */
  coords: Coords | null;
  /** Reported accuracy (metres) of that read; null when unknown. */
  accuracy: number | null;
  /** Distance to the venue pin (metres) from the last read; null until located. */
  distanceM: number | null;
  /** Request permission + read the position; resolves to the resulting status. */
  request: () => Promise<LocationGateStatus>;
}

/** Inert default when read outside a provider (e.g. the scanned flow's screens). */
const FALLBACK: LocationGateValue = {
  applies: false,
  status: "idle",
  coords: null,
  accuracy: null,
  distanceM: null,
  request: async () => "idle",
};

const LocationGateContext = createContext<LocationGateValue | null>(null);

/**
 * Mounted inside VenueProvider so the venue-home banner and the cart checkout
 * gate share ONE reading across the browse screens (the provider persists while
 * the customer moves between landing → menu → cart). `applies` is precomputed
 * by the caller from the ready venue; when false the gate is inert and every
 * screen behaves exactly as before. `lat`/`lng` are passed as primitives so the
 * memoised pin (and the `request` callback) only change when they actually do.
 */
export function LocationGateProvider({
  applies,
  lat,
  lng,
  radiusM,
  children,
}: {
  applies: boolean;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<LocationGateStatus>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);

  const venue = useMemo<Coords | null>(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );
  // Clamp to the same range the edge function enforces so the client's ok/far
  // verdict matches the server's, avoiding a "here" UI that then gets rejected.
  const clampedRadius = useMemo(() => clampGeofence(radiusM), [radiusM]);

  const request = useCallback(async (): Promise<LocationGateStatus> => {
    if (!applies || !venue) {
      setStatus("idle");
      return "idle";
    }
    setStatus("locating");
    try {
      // Same expo-location pattern discovery uses for "near me". iOS never
      // re-prompts once refused (canAskAgain=false): that's a dead end unless
      // we route the customer to Settings, so surface it as a distinct state.
      const { granted, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setCoords(null);
        setAccuracy(null);
        setDistanceM(null);
        const refusal: LocationGateStatus = canAskAgain ? "denied" : "blocked";
        setStatus(refusal);
        return refusal;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here: Coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const acc = pos.coords.accuracy ?? null;
      setCoords(here);
      setAccuracy(acc);
      setDistanceM(distanceMeters(here, venue));
      const next: LocationGateStatus = withinGeofence(here, venue, clampedRadius, acc ?? 0) ? "ok" : "far";
      setStatus(next);
      return next;
    } catch {
      // Position read failed or the native module is unavailable (bare Expo Go).
      setCoords(null);
      setAccuracy(null);
      setDistanceM(null);
      setStatus("unsupported");
      return "unsupported";
    }
  }, [applies, venue, clampedRadius]);

  const value = useMemo<LocationGateValue>(
    () => ({ applies, status, coords, accuracy, distanceM, request }),
    [applies, status, coords, accuracy, distanceM, request],
  );

  return <LocationGateContext.Provider value={value}>{children}</LocationGateContext.Provider>;
}

export function useLocationGate(): LocationGateValue {
  return useContext(LocationGateContext) ?? FALLBACK;
}
