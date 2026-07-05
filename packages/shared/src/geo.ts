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
