"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import { clampGeofence, GEOFENCE_MAX_M, GEOFENCE_MIN_M } from "@chehia/shared";
import { Toggle } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import "leaflet/dist/leaflet.css";

/**
 * Interactive map pin picker for a venue's exact location + geofence radius.
 *
 * Leaflet is strictly client-only: the JS is dynamically imported inside a
 * `useEffect` (never at module top level, so it never touches `window` during
 * SSR), and the map only ever initialises in the browser. We render our own
 * `divIcon` pin (styled HTML) instead of Leaflet's default marker so no broken
 * image path or external asset request is ever made — OSM raster tiles are the
 * only network dependency.
 */

const TUNIS: [number, number] = [36.8065, 10.1815];
const DEFAULT_ZOOM = 13;
const PIN_ZOOM = 16;

/** Harissa-red teardrop pin, tip anchored at the marked point. */
function pinIcon(L: typeof LeafletNS) {
  return L.divIcon({
    className: "",
    html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(60,35,15,0.35))">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.1 25.4 13.7 26a1.7 1.7 0 0 0 2.6 0C16.9 40.4 30 25.5 30 15 30 6.7 23.3 0 15 0Z" fill="var(--color-harissa)"/>
      <circle cx="15" cy="15" r="5.5" fill="#fff"/>
    </svg>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
}

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  require_location: boolean;
}

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  requireLocation: boolean;
  disabled?: boolean;
  onChange: (value: LocationValue) => void;
}

export function LocationPicker({
  latitude,
  longitude,
  radiusM,
  requireLocation,
  disabled = false,
  onChange,
}: LocationPickerProps) {
  const { t } = useI18n();
  const c = t.location.business;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const markerRef = useRef<LeafletNS.Marker | null>(null);
  const circleRef = useRef<LeafletNS.Circle | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const [ready, setReady] = useState(false);

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);

  // Latest props kept in refs so leaflet event handlers (bound once) always
  // emit the *current* full value object without re-binding on every render.
  const valueRef = useRef({ latitude, longitude, radiusM, requireLocation });
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  // Refs are synced in an effect (never written during render).
  useEffect(() => {
    valueRef.current = { latitude, longitude, radiusM, requireLocation };
    onChangeRef.current = onChange;
    disabledRef.current = disabled;
  });

  const emit = useCallback((patch: Partial<LocationValue>) => {
    const v = valueRef.current;
    onChangeRef.current({
      latitude: v.latitude,
      longitude: v.longitude,
      geofence_radius_m: v.radiusM,
      require_location: v.requireLocation,
      ...patch,
    });
  }, []);

  // --- Init the map once, in the browser only (dynamic import = SSR-safe). ---
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const v = valueRef.current;
      const start: [number, number] =
        v.latitude != null && v.longitude != null ? [v.latitude, v.longitude] : TUNIS;
      const map = L.map(containerRef.current, {
        center: start,
        zoom: v.latitude != null ? PIN_ZOOM : DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e: LeafletNS.LeafletMouseEvent) => {
        if (disabledRef.current) return;
        emit({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      });
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [emit]);

  // --- Reflect the pin (marker + geofence circle) from props into leaflet. ---
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !ready) return;

    if (latitude == null || longitude == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }

    const pos: [number, number] = [latitude, longitude];
    const firstPin = !markerRef.current;

    if (!markerRef.current) {
      const marker = L.marker(pos, { draggable: !disabledRef.current, icon: pinIcon(L) }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        emit({ latitude: ll.lat, longitude: ll.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(pos);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(pos, {
        radius: valueRef.current.radiusM,
        color: "var(--color-harissa)",
        weight: 2,
        fillColor: "var(--color-harissa)",
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(pos);
    }

    // Recenter on the pin: zoom in the first time it's dropped, otherwise just
    // pan so a drag/tap keeps the current zoom.
    if (firstPin) map.setView(pos, Math.max(map.getZoom(), PIN_ZOOM));
    else map.panTo(pos);
  }, [latitude, longitude, ready, emit]);

  // Keep the geofence circle in sync with the radius control.
  useEffect(() => {
    circleRef.current?.setRadius(radiusM);
  }, [radiusM]);

  // Enable/disable marker dragging if the caller's permission changes.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (disabled) marker.dragging?.disable();
    else marker.dragging?.enable();
  }, [disabled, ready, latitude, longitude]);

  const useMyLocation = () => {
    if (disabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(true);
      return;
    }
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        emit({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setGeoError(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const onRadius = (raw: number) => {
    if (disabled) return;
    emit({ geofence_radius_m: clampGeofence(raw) });
  };

  const hasPin = latitude != null && longitude != null;

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[12.5px] text-muted leading-relaxed">{c.subtitle}</p>

      {/* Status + use-my-location */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 text-[12px] font-extrabold rounded-full px-3 py-1.5 ${
            hasPin ? "text-success-text bg-success-tint" : "text-muted-soft bg-sand-deep"
          }`}
        >
          {hasPin ? `✓ ${c.pinSet}` : c.noPin}
        </span>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={disabled || locating}
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border-[1.5px] border-line-strong bg-white text-[13px] font-bold text-ink cursor-pointer hover:border-harissa transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {locating ? (
            <>
              <span className="w-4 h-4 border-[2px] border-harissa border-t-transparent rounded-full animate-spin" />
              {c.locating}
            </>
          ) : (
            <>
              <LocateIcon />
              {c.useMyLocation}
            </>
          )}
        </button>
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        role="application"
        aria-label={c.title}
        className="relative h-64 w-full rounded-xl overflow-hidden border border-line-strong bg-sand isolate"
      />

      <p className="text-[11.5px] text-muted-soft leading-relaxed">{c.pinHint}</p>
      {geoError && <p className="text-[12px] font-bold text-danger-text">{t.discover.locationUnavailable}</p>}

      {/* Radius */}
      <div className="flex flex-col gap-2 pt-2 border-t border-line">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-extrabold text-ink">{c.radiusLabel}</span>
          <span className="text-[13px] font-extrabold text-harissa-pressed tabular-nums" dir="ltr">
            {c.meters.replace("{n}", String(radiusM))}
          </span>
        </div>
        <div className="flex items-center gap-3" dir="ltr">
          <input
            type="range"
            min={GEOFENCE_MIN_M}
            max={GEOFENCE_MAX_M}
            step={10}
            value={radiusM}
            disabled={disabled}
            onChange={(e) => onRadius(Number(e.target.value))}
            className="flex-1 accent-harissa cursor-pointer disabled:opacity-60"
            aria-label={c.radiusLabel}
          />
          <input
            type="number"
            min={GEOFENCE_MIN_M}
            max={GEOFENCE_MAX_M}
            step={10}
            value={radiusM}
            disabled={disabled}
            onChange={(e) => onRadius(Number(e.target.value))}
            className="h-10 w-20 rounded-md border-[1.5px] border-line-strong bg-white px-2.5 text-sm font-bold text-ink outline-none focus:border-harissa disabled:opacity-60"
            aria-label={c.radiusLabel}
          />
        </div>
        <span className="text-[11.5px] text-muted-soft leading-relaxed">{c.radiusHint}</span>
      </div>

      {/* Require on-site toggle */}
      <div className="flex items-start justify-between gap-3 pt-3 border-t border-line">
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-[13px] font-extrabold text-ink">{c.requireLocation}</span>
          <span className="text-[11.5px] text-muted leading-relaxed">{c.requireLocationHint}</span>
        </div>
        <Toggle
          checked={requireLocation}
          onChange={(next) => !disabled && emit({ require_location: next })}
          label={c.requireLocation}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function LocateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v3M12 19v3M22 12h-3M5 12H2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}
