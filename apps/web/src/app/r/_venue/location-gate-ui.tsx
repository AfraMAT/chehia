"use client";

import { formatDistanceKm, interpolate } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/ui";
import type { LocationGate } from "./use-location-gate";

/** Format the gate's stored distance-to-venue for the `{d}` placeholder. */
function distanceLabel(gate: LocationGate, lang: string): string {
  return formatDistanceKm((gate.distanceM ?? 0) / 1000, lang);
}

/**
 * Full checkout gate panel (cart screen). Walks the customer from
 * "share your location" → locating → on-site confirmation, or surfaces a
 * too-far / denied state with a retry. The place button stays disabled until
 * the gate reaches `ok`.
 */
export function LocationGatePanel({ gate, venueName }: { gate: LocationGate; venueName: string }) {
  const { t, lang } = useI18n();
  const g = t.location.gate;

  if (gate.state === "ok") {
    return (
      <div className="rounded-xl bg-teal-tint px-4 py-3 flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-[12px] font-extrabold shrink-0" aria-hidden>
          ✓
        </span>
        <span className="flex-1 text-[13px] font-bold text-teal-pressed">
          {g.here} — {g.hereBody}
        </span>
      </div>
    );
  }

  if (gate.state === "locating") {
    return (
      <div className="rounded-xl bg-card border border-line px-4 py-3.5 flex items-center gap-3">
        <Spinner className="text-teal w-5 h-5" />
        <span className="text-[13.5px] font-semibold text-muted">{g.locating}</span>
      </div>
    );
  }

  if (gate.state === "far") {
    return (
      <div className="rounded-xl bg-danger-tint px-4 py-3.5 flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-extrabold text-danger-text">{g.tooFar}</span>
          <span className="text-[12.5px] font-semibold text-danger-text/80">
            {interpolate(g.tooFarBody, { venue: venueName, d: distanceLabel(gate, lang) })}
          </span>
        </div>
        <RetryButton onClick={gate.request} label={g.retry} />
      </div>
    );
  }

  if (gate.state === "denied" || gate.state === "unsupported") {
    return (
      <div className="rounded-xl bg-card border border-line px-4 py-3.5 flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-extrabold text-ink">{g.denied}</span>
          <span className="text-[12.5px] font-semibold text-muted">{g.deniedBody}</span>
        </div>
        <RetryButton onClick={gate.request} label={g.retry} />
      </div>
    );
  }

  // idle
  return (
    <div className="rounded-xl bg-card border border-line px-4 py-3.5 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-teal-tint text-teal-pressed flex items-center justify-center text-lg font-extrabold shrink-0" aria-hidden>
          ⌖
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-extrabold text-ink">{g.shareToOrder}</span>
          <span className="text-[12.5px] font-semibold text-muted">
            {interpolate(g.shareBody, { venue: venueName })}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={gate.request}
        className="h-11 rounded-lg bg-teal text-white font-extrabold text-[14px] flex items-center justify-center cursor-pointer hover:bg-teal-pressed transition-colors"
      >
        {g.shareCta}
      </button>
    </div>
  );
}

function RetryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-lg bg-teal text-white font-extrabold text-[13.5px] flex items-center justify-center cursor-pointer hover:bg-teal-pressed transition-colors"
    >
      {label}
    </button>
  );
}

/**
 * Compact venue-home status line reflecting the same shared gate. Prompts to
 * share, then flips to an on-site confirmation (teal) or a distance-away hint
 * (danger). A single tap kicks off / retries the geolocation request.
 */
export function LocationBanner({ gate, className = "" }: { gate: LocationGate; className?: string }) {
  const { t, lang } = useI18n();
  const g = t.location.gate;

  if (gate.state === "ok") {
    return (
      <div className={`rounded-lg bg-teal-tint px-4 py-2.5 flex items-center gap-2 ${className}`}>
        <span className="w-4 h-4 rounded-full bg-teal text-white flex items-center justify-center text-[10px] font-extrabold shrink-0" aria-hidden>
          ✓
        </span>
        <span className="text-[13px] font-bold text-teal-pressed">{g.here}</span>
      </div>
    );
  }

  if (gate.state === "locating") {
    return (
      <div className={`rounded-lg bg-card border border-line px-4 py-2.5 flex items-center gap-2.5 ${className}`}>
        <Spinner className="text-teal w-4 h-4" />
        <span className="text-[13px] font-semibold text-muted">{g.locating}</span>
      </div>
    );
  }

  if (gate.state === "far") {
    return (
      <button
        type="button"
        onClick={gate.request}
        className={`w-full rounded-lg bg-danger-tint px-4 py-2.5 flex items-center gap-2 text-start cursor-pointer ${className}`}
      >
        <span className="w-[7px] h-[7px] rounded-full bg-danger shrink-0" aria-hidden />
        <span className="flex-1 text-[13px] font-bold text-danger-text">
          {interpolate(g.away, { d: distanceLabel(gate, lang) })}
        </span>
        <span className="text-[12px] font-bold text-danger-text/70 underline shrink-0">{g.retry}</span>
      </button>
    );
  }

  // idle / denied / unsupported — invite the customer to share their location.
  const body = gate.state === "idle" ? g.shareToOrder : g.deniedBody;
  return (
    <button
      type="button"
      onClick={gate.request}
      className={`w-full rounded-lg bg-card border-[1.5px] border-dashed border-line-dashed px-4 py-2.5 flex items-center gap-2.5 text-start cursor-pointer hover:border-teal transition-colors ${className}`}
    >
      <span className="w-6 h-6 rounded-md bg-teal-tint text-teal-pressed flex items-center justify-center text-sm font-extrabold shrink-0" aria-hidden>
        ⌖
      </span>
      <span className="flex-1 text-[13px] font-bold text-ink">{body}</span>
      <span className="text-[12px] font-bold text-teal-pressed shrink-0">{g.shareCta}</span>
    </button>
  );
}
