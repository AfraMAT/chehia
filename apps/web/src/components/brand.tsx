/** Brand primitives: the 8-point zellige star mark and the wordmark. */

/**
 * The Chehia "Scan & Sip" mark — a rounded harissa tile with a steaming coffee
 * cup, echoing the app icon (scan → order → sip). Café-shaped for the Tunisian
 * market. Kept the `ZelligeMark` export name so every existing caller works.
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
      {/* steaming coffee cup, centered */}
      <g transform="translate(50,52) scale(0.62)" fill={inner}>
        <path d="M -44 -4 h 70 v 20 a 35 35 0 0 1 -70 0 z" />
        <path d="M 26 2 h 14 a 17 17 0 0 1 0 34 h -8 v -12 h 6 a 5 5 0 0 0 0 -10 h -12 z" />
        <g stroke={inner} strokeWidth="6.5" strokeLinecap="round" fill="none">
          <path d="M -22 -20 q 8 -11 0 -24" />
          <path d="M -1 -20 q 8 -11 0 -24" />
          <path d="M 19 -20 q 8 -11 0 -24" />
        </g>
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
