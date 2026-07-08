import { describe, expect, it } from "vitest";
import {
  clampGeofence,
  DEFAULT_GEOFENCE_M,
  distanceMeters,
  formatDistanceKm,
  GEOFENCE_ACCURACY_SLACK_M,
  GEOFENCE_MAX_M,
  GEOFENCE_MIN_M,
  haversineKm,
  withinGeofence,
} from "../geo";

// Café El Marsa's seeded pin.
const venue = { latitude: 36.8783, longitude: 10.3247 };

describe("distanceMeters", () => {
  it("is ~0 at the same point", () => {
    expect(distanceMeters(venue, venue)).toBeCloseTo(0, 5);
  });

  it("agrees with haversineKm scaled to metres", () => {
    const other = { latitude: 36.833, longitude: 10.273 };
    expect(distanceMeters(venue, other)).toBeCloseTo(haversineKm(venue, other) * 1000, 3);
  });

  it("measures a ~111 m step of 0.001° north within a few metres", () => {
    const north = { latitude: venue.latitude + 0.001, longitude: venue.longitude };
    const d = distanceMeters(venue, north);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(120);
  });
});

describe("withinGeofence", () => {
  it("passes when standing on the pin", () => {
    expect(withinGeofence(venue, venue, DEFAULT_GEOFENCE_M)).toBe(true);
  });

  it("passes just inside the radius and fails well outside it", () => {
    // ~111 m north (0.001° lat), 200 m radius → inside.
    const near = { latitude: venue.latitude + 0.001, longitude: venue.longitude };
    expect(withinGeofence(near, venue, 200)).toBe(true);
    // ~1.1 km north → outside any sane café radius.
    const far = { latitude: venue.latitude + 0.01, longitude: venue.longitude };
    expect(withinGeofence(far, venue, 200)).toBe(false);
  });

  it("adds the reading's accuracy as slack, capped", () => {
    // ~280 m out, radius 200 → fails without slack…
    const edge = { latitude: venue.latitude + 0.0025, longitude: venue.longitude };
    expect(withinGeofence(edge, venue, 200, 0)).toBe(false);
    // …a 90 m accuracy fix pushes the allowance to 290 m → passes.
    expect(withinGeofence(edge, venue, 200, 90)).toBe(true);
    // Slack is capped at GEOFENCE_ACCURACY_SLACK_M, so a wildly loose fix
    // can't unlock ordering from far away.
    const veryFar = { latitude: venue.latitude + 0.02, longitude: venue.longitude };
    expect(withinGeofence(veryFar, venue, 200, 100_000)).toBe(false);
    expect(GEOFENCE_ACCURACY_SLACK_M).toBe(100);
  });
});

describe("clampGeofence", () => {
  it("bounds into [min, max] and rounds", () => {
    expect(clampGeofence(5)).toBe(GEOFENCE_MIN_M);
    expect(clampGeofence(10_000)).toBe(GEOFENCE_MAX_M);
    expect(clampGeofence(150.6)).toBe(151);
  });

  it("falls back to the default on non-finite input", () => {
    expect(clampGeofence(Number.NaN)).toBe(DEFAULT_GEOFENCE_M);
  });
});

describe("formatDistanceKm (unchanged behaviour sanity)", () => {
  it("formats metres under 1 km", () => {
    expect(formatDistanceKm(0.12, "en")).toBe("120 m");
  });
});
