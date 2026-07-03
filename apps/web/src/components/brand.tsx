/** Brand primitives: the 8-point zellige star mark and the wordmark. */

/**
 * The Chehia "Scan & Fork" mark — a QR-scan finder + a fork, echoing the app
 * icon (scan → order → eat). Reduced form (single finder + fork) so it stays
 * legible from ~16px nav marks up. Kept the `ZelligeMark` export name so every
 * existing caller keeps working.
 */
export function ZelligeMark({
  size = 30,
  color = "#BC4B26",
  inner = "#FFFFFF",
  radius,
}: {
  size?: number;
  color?: string;
  inner?: string;
  radius?: number;
}) {
  const rx = ((radius ?? size * 0.3) / size) * 100;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <rect width="100" height="100" rx={rx} fill={color} />
      {/* "scan" QR finder, top-left */}
      <rect x="19" y="19" width="25" height="25" rx="7" fill="none" stroke={inner} strokeWidth="5.5" />
      <rect x="28" y="28" width="7" height="7" rx="2" fill={inner} />
      {/* fork */}
      <g fill={inner}>
        <rect x="52" y="40" width="4.4" height="23" rx="2.2" />
        <rect x="59" y="40" width="4.4" height="23" rx="2.2" />
        <rect x="66" y="40" width="4.4" height="23" rx="2.2" />
        <rect x="52" y="59" width="18.4" height="5" rx="2.5" />
        <rect x="59" y="62" width="4.8" height="21" rx="2.4" />
      </g>
    </svg>
  );
}

export function Wordmark({
  size = 19,
  color = "#221A13",
  dotColor = "#BC4B26",
}: {
  size?: number;
  color?: string;
  dotColor?: string;
}) {
  return (
    <span
      className="font-display font-extrabold tracking-tight leading-none"
      style={{ fontSize: size, color }}
    >
      chehia<span style={{ color: dotColor }}>.</span>
    </span>
  );
}

export function Logo({ markSize = 30, textSize = 19, dark = false }: { markSize?: number; textSize?: number; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <ZelligeMark size={markSize} />
      <Wordmark size={textSize} color={dark ? "#FAF6EF" : "#221A13"} dotColor={dark ? "#E08D6B" : "#BC4B26"} />
    </div>
  );
}
