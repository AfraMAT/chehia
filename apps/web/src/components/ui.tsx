"use client";

import type { OrderStatus } from "@chehia/shared";

/* Core UI primitives matching board A4 of the design canvas. */

type ButtonVariant = "primary" | "secondary" | "outline" | "dark" | "danger-ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-harissa text-white font-extrabold shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed active:bg-harissa-pressed disabled:bg-disabled disabled:shadow-none",
  secondary: "bg-harissa-tint text-harissa-pressed font-bold hover:bg-[#F2DCCE] disabled:opacity-50",
  outline:
    "border-[1.5px] border-line-strong bg-card text-ink font-bold hover:border-harissa hover:text-harissa-pressed disabled:opacity-50",
  dark: "bg-ink text-cream font-extrabold hover:opacity-90 disabled:opacity-50",
  "danger-ghost": "text-danger font-bold hover:bg-danger-tint disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 min-h-11 text-[15px] transition-colors cursor-pointer disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

/** Status pill — never color-only: dot + label. */
export function StatusChip({
  status,
  label,
  pulse = false,
}: {
  status: OrderStatus | "info";
  label: string;
  pulse?: boolean;
}) {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    new: { bg: "bg-harissa-tint", text: "text-harissa-pressed", dot: "bg-harissa" },
    preparing: { bg: "bg-warning-tint", text: "text-warning-text", dot: "bg-warning" },
    ready: { bg: "bg-success-tint", text: "text-success-text", dot: "bg-success" },
    served: { bg: "bg-success-tint", text: "text-success-text", dot: "bg-success" },
    cancelled: { bg: "bg-danger-tint", text: "text-danger-text", dot: "bg-danger" },
    info: { bg: "bg-teal-tint", text: "text-teal-pressed", dot: "bg-teal" },
  };
  const s = styles[status] ?? styles.info;
  return (
    <span className={`inline-flex items-center gap-1.5 ${s.bg} ${s.text} font-bold text-xs px-3 py-1.5 rounded-full`}>
      <span className={`w-[7px] h-[7px] rounded-full ${s.dot} ${pulse ? "animate-ch-pulse" : ""}`} />
      {label}
    </span>
  );
}

/** Dietary / menu tag. */
export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "neutral" | "popular" | "soldout";
}) {
  const styles = {
    green: "border-[1.5px] border-success-border text-success-text",
    amber: "border-[1.5px] border-warning-border text-warning-text",
    neutral: "border-[1.5px] border-line-strong text-muted",
    popular: "bg-harissa-tint text-harissa-pressed font-extrabold",
    soldout: "bg-sand-deep text-muted-soft line-through",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-full ${styles[tone]}`}>
      {children}
    </span>
  );
}

/** Quantity stepper — 44px targets. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9" : "h-11";
  const w = size === "sm" ? "w-10" : "w-11";
  return (
    <div className={`inline-flex items-center border-[1.5px] border-line-strong rounded-full bg-white ${h}`}>
      <button
        type="button"
        aria-label="−"
        className={`${w} ${h} flex items-center justify-center text-harissa font-extrabold text-xl cursor-pointer disabled:opacity-30`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="w-6 text-center font-extrabold text-ink tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="+"
        className={`${w} ${h} flex items-center justify-center text-harissa font-extrabold text-xl cursor-pointer disabled:opacity-30`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

/** Availability toggle. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-[42px] h-[26px] rounded-full transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harissa focus-visible:ring-offset-2 ${
        checked ? "bg-success" : "bg-line-dashed"
      }`}
    >
      <span
        className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all ${
          checked ? "start-[19px]" : "start-[3px]"
        }`}
      />
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-line rounded-xl shadow-[0_1px_4px_rgba(60,35,15,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function PhotoPlaceholder({ className = "", src, alt = "" }: { className?: string; src?: string | null; alt?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
  }
  return <div aria-hidden className={`photo-placeholder ${className}`} />;
}

export function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`w-[18px] h-[18px] ${className}`} aria-hidden>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="m13.5 13.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="loading"
      className={`inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}

/** Skeleton loading block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`bg-sand-deep rounded-md animate-ch-pulse ${className}`} />;
}

const STAR_GOLD = "#E0A63C";
const STAR_EMPTY = "#E3D9CB";

/** Read-only star row with fractional fill (e.g. 4.3 → 4.3 gold stars). */
export function Stars({ value, size = 16, className = "" }: { value: number | null | undefined; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100));
  return (
    <span
      aria-hidden
      className={`relative inline-block whitespace-nowrap align-middle ${className}`}
      style={{ fontSize: size, lineHeight: 1, letterSpacing: "1px" }}
    >
      <span style={{ color: STAR_EMPTY }}>★★★★★</span>
      <span className="absolute left-0 top-0 overflow-hidden" style={{ color: STAR_GOLD, width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

/** Interactive 1–5 star picker with 44px targets. */
export function StarInput({
  value,
  onChange,
  size = 40,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} / 5`}
          onClick={() => onChange(n)}
          className="flex items-center justify-center rounded-lg cursor-pointer transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harissa"
          style={{ width: 44, height: 44, fontSize: size, lineHeight: 1, color: n <= value ? STAR_GOLD : STAR_EMPTY }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Three big emoji faces for the overall visit rating. */
export function FaceInput({
  value,
  onChange,
  options,
}: {
  value: "love" | "good" | "meh" | null;
  onChange: (s: "love" | "good" | "meh") => void;
  options: { key: "love" | "good" | "meh"; emoji: string; label: string }[];
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2.5">
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.label}
            onClick={() => onChange(o.key)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl py-4 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harissa ${
              selected
                ? "bg-harissa-tint border-[1.5px] border-harissa scale-[1.02]"
                : "bg-card border-[1.5px] border-line hover:border-line-strong"
            }`}
          >
            <span style={{ fontSize: 40, lineHeight: 1, filter: selected ? "none" : "grayscale(0.35)" }}>{o.emoji}</span>
            <span className={`text-[13px] font-bold ${selected ? "text-harissa-pressed" : "text-muted"}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
