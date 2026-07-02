/** Brand primitives: the 8-point zellige star mark and the wordmark. */

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
  const sq = size * 0.44;
  return (
    <div
      aria-hidden
      className="relative shrink-0"
      style={{ width: size, height: size, background: color, borderRadius: radius ?? size * 0.3 }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: sq, height: sq, background: inner, borderRadius: size * 0.07 }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45"
        style={{ width: sq, height: sq, background: inner, borderRadius: size * 0.07 }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: size * 0.16, height: size * 0.16, background: color }}
      />
    </div>
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
