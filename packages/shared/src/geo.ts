/** Geolocation helpers for restaurant discovery ("near me" sorting). */

export interface Coords {
  latitude: number;
  longitude: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometres between two points (Haversine). */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371; // Earth radius, km
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Great-circle distance in metres between two points. */
export function distanceMeters(a: Coords, b: Coords): number {
  return haversineKm(a, b) * 1000;
}

/**
 * Default geofence radius, in metres — how close a customer must be to the
 * venue's pin to order in the remote (browse) flow. ~200 m comfortably covers a
 * building plus its terrace/immediate surroundings while still ruling out
 * ordering from home. Venues can tune it (see `GEOFENCE_MIN_M`/`GEOFENCE_MAX_M`).
 */
export const DEFAULT_GEOFENCE_M = 200;
export const GEOFENCE_MIN_M = 20;
export const GEOFENCE_MAX_M = 5000;

/**
 * Consumer GPS is imprecise (especially indoors). We add the reading's own
 * reported accuracy to the allowed radius, capped by this slack, so a customer
 * genuinely at the venue is never blocked by a loose fix — while a customer at
 * home (hundreds of metres out) still fails the check.
 */
export const GEOFENCE_ACCURACY_SLACK_M = 100;

/** Clamp a venue-configured radius into the allowed range. */
export function clampGeofence(m: number): number {
  if (!Number.isFinite(m)) return DEFAULT_GEOFENCE_M;
  return Math.min(GEOFENCE_MAX_M, Math.max(GEOFENCE_MIN_M, Math.round(m)));
}

/**
 * Is `here` close enough to `venue` to be considered "at" it? Adds the GPS
 * reading's accuracy (bounded by GEOFENCE_ACCURACY_SLACK_M) to the radius so a
 * fuzzy-but-honest fix passes. Pure + framework-free so web + mobile + the
 * edge function all decide identically.
 */
export function withinGeofence(
  here: Coords,
  venue: Coords,
  radiusM: number,
  accuracyM = 0,
): boolean {
  const slack = Math.min(GEOFENCE_ACCURACY_SLACK_M, Math.max(0, accuracyM));
  return distanceMeters(here, venue) <= radiusM + slack;
}

/**
 * Human-friendly distance: "120 m", "1,4 km", "12 km". The decimal separator
 * matches the locale ('.' for en, ',' otherwise), consistent with money; units
 * are localized for Arabic ("م" / "كم") while keeping Western digits.
 */
export function formatDistanceKm(km: number, lang: string = "fr"): string {
  const sep = lang === "en" ? "." : ",";
  const unit = lang === "ar" ? { m: "م", km: "كم" } : { m: "m", km: "km" };
  if (km < 1) {
    const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
    return `${m} ${unit.m}`;
  }
  if (km < 10) {
    return `${km.toFixed(1).replace(".", sep)} ${unit.km}`;
  }
  return `${Math.round(km)} ${unit.km}`;
}
