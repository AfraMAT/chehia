import { resolveMenuArt, type ImageStyle, type I18nText, type MenuArtId } from "@chehia/shared";
import { PhotoPlaceholder } from "@/components/ui";

/**
 * Default menu artwork — tasteful, theme-aware SVG illustrations shown when an
 * item/category has no uploaded photo. Every shape uses the venue's --color-*
 * variables, so the art re-skins automatically with the chosen theme.
 */

// Theme tokens (re-skinned per venue via the layout's CSS-var overrides).
const H = "var(--color-harissa)";
const HS = "var(--color-harissa-soft)";
const HP = "var(--color-harissa-peach)";
const HD = "var(--color-harissa-pressed)";
const CARD = "var(--color-card)";
const TINT = "var(--color-harissa-tint)";

const ART: Record<MenuArtId, React.ReactNode> = {
  coffee: (
    <>
      <path d="M43 29 q6 -5 0 -11 M52 31 q6 -5 0 -11" fill="none" stroke={HS} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx="49" cy="72" rx="25" ry="4.5" fill={HS} />
      <path d="M32 39 h34 l-2.5 22 a14.5 14.5 0 0 1 -29 0 z" fill={H} />
      <ellipse cx="49" cy="40" rx="17" ry="3.5" fill={HD} />
      <path d="M67 43 a10.5 10.5 0 0 1 0 16" fill="none" stroke={H} strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  tea: (
    <>
      <path d="M50 40 q-8 -6 -15 -3 q2 8 15 3 z" fill={HS} />
      <path d="M50 40 q8 -8 16 -4 q-3 9 -16 4 z" fill={H} />
      <line x1="50" y1="45" x2="50" y2="36" stroke={HD} strokeWidth={2} strokeLinecap="round" />
      <path d="M35 44 h30 l-3.5 28 a11 11 0 0 1 -23 0 z" fill={CARD} stroke={H} strokeWidth={3} strokeLinejoin="round" />
      <path d="M39 54 h22 l-2.8 18 a9 9 0 0 1 -16.4 0 z" fill={HP} />
      <path d="M64.5 50 a9 9 0 0 1 0 15" fill="none" stroke={H} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  juice: (
    <>
      <line x1="59" y1="21" x2="53" y2="64" stroke={HD} strokeWidth={4} strokeLinecap="round" />
      <path d="M36 32 h28 l-3.5 40 a5 5 0 0 1 -5 4.2 h-11 a5 5 0 0 1 -5 -4.2 z" fill={CARD} stroke={H} strokeWidth={3} strokeLinejoin="round" />
      <path d="M39 50 h22 l-2.6 22 a4 4 0 0 1 -4 3.5 h-8.8 a4 4 0 0 1 -4 -3.5 z" fill={H} />
      <circle cx="41" cy="31" r="7.5" fill={HP} stroke={H} strokeWidth={2} />
      <path d="M41 23.5 v15 M33.5 31 h15" stroke={H} strokeWidth={1.4} />
    </>
  ),
  drink: (
    <>
      <line x1="56" y1="19" x2="53" y2="37" stroke={HD} strokeWidth={4} strokeLinecap="round" />
      <path d="M35 41 h30 l-3.5 29 a9 9 0 0 1 -23 0 z" fill={H} />
      <path d="M32 34 q18 -7 36 0 l-1.5 7 h-33 z" fill={HS} />
      <rect x="41" y="52" width="18" height="3.5" rx="1.75" fill={CARD} opacity="0.55" />
    </>
  ),
  pastry: (
    <>
      <path d="M41 58 h18 l-2.5 16 h-13 z" fill={HS} />
      <path d="M45 58 v16 M50 58 v16 M55 58 v16" stroke={HD} strokeWidth={1} opacity="0.35" />
      <path d="M36 59 q-1 -10 8 -12 q1 -9 9 -8 q9 -1 9 9 q7 3 4 11 z" fill={H} />
      <circle cx="50" cy="35" r="3.6" fill={HP} />
      <path d="M50 35 q3 -4 5.5 -3.5" fill="none" stroke={HD} strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  dessert: (
    <>
      <circle cx="43" cy="44" r="8.5" fill={H} />
      <circle cx="57" cy="44" r="8.5" fill={HS} />
      <circle cx="50" cy="37" r="8.5" fill={HP} />
      <path d="M41.5 50 h17 l-8.5 24 z" fill={HP} stroke={H} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M46 52 l2.5 8 M54 52 l-2.5 8 M50 51 v10" stroke={H} strokeWidth={1} opacity="0.4" />
    </>
  ),
  breakfast: (
    <>
      <circle cx="50" cy="53" r="24" fill={CARD} stroke={HS} strokeWidth={3} />
      <path d="M39 49 q-5 -8 4 -10 q3 -7 10 -4 q9 -3 11 6 q7 5 -1 11 q3 9 -8 8 q-8 4 -12 -4 q-9 1 -8 -7 z" fill={HP} />
      <circle cx="46" cy="50" r="6.5" fill={H} />
    </>
  ),
  bread: (
    <>
      <path d="M30 46 a20 12 0 0 1 40 0 z" fill={HS} />
      <circle cx="41" cy="41" r="1.4" fill={CARD} />
      <circle cx="50" cy="39" r="1.4" fill={CARD} />
      <circle cx="59" cy="41" r="1.4" fill={CARD} />
      <path d="M30 46 h40 v4 h-40 z" fill={H} />
      <path d="M29 50 q21 6 42 0 v2 q-21 6 -42 0 z" fill={HP} />
      <path d="M30 54 h40 v2 a20 8 0 0 1 -40 0 z" fill={HS} />
    </>
  ),
  salad: (
    <>
      <circle cx="41" cy="45" r="8" fill={HS} />
      <circle cx="56" cy="44" r="8" fill={HP} />
      <circle cx="49" cy="49" r="8.5" fill={H} />
      <path d="M28 51 h44 a22 15 0 0 1 -44 0 z" fill={H} />
      <ellipse cx="50" cy="51" rx="22" ry="4" fill={HS} />
    </>
  ),
  main: (
    <>
      <circle cx="50" cy="50" r="20" fill={CARD} stroke={HS} strokeWidth={3} />
      <circle cx="50" cy="50" r="11" fill={HP} />
      <path d="M17 32 v9 M20 32 v9 M23 32 v9" stroke={H} strokeWidth={2.3} strokeLinecap="round" />
      <path d="M20 41 v27" stroke={H} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M80 32 q5 1 5 9 v27" fill="none" stroke={H} strokeWidth={3.4} strokeLinecap="round" />
    </>
  ),
  pizza: (
    <>
      <path d="M50 27 l18 40 a42 42 0 0 1 -36 0 z" fill={HP} stroke={H} strokeWidth={3} strokeLinejoin="round" />
      <path d="M32 67 a42 42 0 0 1 36 0" fill="none" stroke={H} strokeWidth={5} strokeLinecap="round" />
      <circle cx="46" cy="53" r="3.2" fill={H} />
      <circle cx="55" cy="58" r="3.2" fill={H} />
      <circle cx="49" cy="63" r="3.2" fill={H} />
    </>
  ),
  generic: (
    <>
      <circle cx="50" cy="50" r="21" fill={CARD} stroke={HS} strokeWidth={3} />
      <circle cx="50" cy="50" r="11.5" fill={HP} />
      <path d="M30 36 v8 M33 36 v8 M31.5 44 v18" stroke={H} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M68 36 q4 1 4 7 v19" fill="none" stroke={H} strokeWidth={2.8} strokeLinecap="round" />
    </>
  ),
};

/** A single default illustration; `className` sizes + rounds the box. */
export function MenuArt({ id, className = "" }: { id: MenuArtId; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="w-full h-full" role="img" aria-hidden>
        <rect width="100" height="100" fill={TINT} />
        {ART[id] ?? ART.generic}
      </svg>
    </div>
  );
}

/**
 * The image for a menu item/category: the uploaded photo when present, else the
 * default per the venue's imageStyle (a matched illustration, the woven pattern,
 * or a plain tint).
 */
export function MenuImage({
  src,
  name,
  art,
  fallbackName,
  imageStyle,
  className = "",
}: {
  src?: string | null;
  name: I18nText;
  art?: string | null;
  /** Parent category name, used to pick art when the item's own name is inconclusive. */
  fallbackName?: I18nText | null;
  imageStyle: ImageStyle;
  className?: string;
}) {
  if (src) return <PhotoPlaceholder src={src} className={className} />;
  if (imageStyle === "plain") return <div className={`bg-harissa-tint ${className}`} />;
  if (imageStyle === "pattern") return <PhotoPlaceholder className={className} />;
  return <MenuArt id={resolveMenuArt(art, name, fallbackName)} className={className} />;
}
