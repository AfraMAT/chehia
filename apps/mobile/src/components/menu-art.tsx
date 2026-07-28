import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { resolveMenuArt, type I18nText, type ImageStyle, type MenuArtId } from "@chehia/shared";
import { useTheme, type ThemeColors } from "@/lib/theme";
import { PhotoPlaceholder } from "./ui";

/**
 * Default menu artwork — the mobile twin of apps/web/src/components/menu-art.tsx.
 *
 * The web app has shown a matched illustration for any dish without a photo
 * since menu art shipped; mobile never got it, so every item on the customer
 * menu rendered as a blank diagonal-weave square. On a food-ordering app that is
 * the core screen, and it is what the App Store screenshots showed.
 *
 * The path data is copied verbatim from the web component so the two surfaces
 * stay visually identical. Only the colour source differs: web reads
 * `var(--color-*)`, here they come from the resolved venue theme, so the art
 * re-skins per venue exactly the same way.
 *
 * Keep the two files in lockstep — `MENU_ART_IDS` in packages/shared owns the
 * list, and a new id must be drawn in BOTH or one surface falls back to generic.
 */

/** viewBox is 100×100 in both apps; every path below is authored in that space. */
const VIEW_BOX = "0 0 100 100";

function artFor(id: MenuArtId, c: ThemeColors) {
  const H = c.harissa;
  const HS = c.harissaSoft;
  const HP = c.harissaPeach;
  const HD = c.harissaPressed;
  const CARD = c.card;

  switch (id) {
    case "coffee":
      return (
        <G>
          <Path d="M43 29 q6 -5 0 -11 M52 31 q6 -5 0 -11" fill="none" stroke={HS} strokeWidth={3} strokeLinecap="round" />
          <Ellipse cx={49} cy={72} rx={25} ry={4.5} fill={HS} />
          <Path d="M32 39 h34 l-2.5 22 a14.5 14.5 0 0 1 -29 0 z" fill={H} />
          <Ellipse cx={49} cy={40} rx={17} ry={3.5} fill={HD} />
          <Path d="M67 43 a10.5 10.5 0 0 1 0 16" fill="none" stroke={H} strokeWidth={5} strokeLinecap="round" />
        </G>
      );
    case "tea":
      return (
        <G>
          <Path d="M50 40 q-8 -6 -15 -3 q2 8 15 3 z" fill={HS} />
          <Path d="M50 40 q8 -8 16 -4 q-3 9 -16 4 z" fill={H} />
          <Line x1={50} y1={45} x2={50} y2={36} stroke={HD} strokeWidth={2} strokeLinecap="round" />
          <Path d="M35 44 h30 l-3.5 28 a11 11 0 0 1 -23 0 z" fill={CARD} stroke={H} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M39 54 h22 l-2.8 18 a9 9 0 0 1 -16.4 0 z" fill={HP} />
          <Path d="M64.5 50 a9 9 0 0 1 0 15" fill="none" stroke={H} strokeWidth={4} strokeLinecap="round" />
        </G>
      );
    case "juice":
      return (
        <G>
          <Line x1={59} y1={21} x2={53} y2={64} stroke={HD} strokeWidth={4} strokeLinecap="round" />
          <Path d="M36 32 h28 l-3.5 40 a5 5 0 0 1 -5 4.2 h-11 a5 5 0 0 1 -5 -4.2 z" fill={CARD} stroke={H} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M39 50 h22 l-2.6 22 a4 4 0 0 1 -4 3.5 h-8.8 a4 4 0 0 1 -4 -3.5 z" fill={H} />
          <Circle cx={41} cy={31} r={7.5} fill={HP} stroke={H} strokeWidth={2} />
          <Path d="M41 23.5 v15 M33.5 31 h15" stroke={H} strokeWidth={1.4} />
        </G>
      );
    case "drink":
      return (
        <G>
          <Line x1={56} y1={19} x2={53} y2={37} stroke={HD} strokeWidth={4} strokeLinecap="round" />
          <Path d="M35 41 h30 l-3.5 29 a9 9 0 0 1 -23 0 z" fill={H} />
          <Path d="M32 34 q18 -7 36 0 l-1.5 7 h-33 z" fill={HS} />
          <Rect x={41} y={52} width={18} height={3.5} rx={1.75} fill={CARD} opacity={0.55} />
        </G>
      );
    case "pastry":
      return (
        <G>
          <Path d="M41 58 h18 l-2.5 16 h-13 z" fill={HS} />
          <Path d="M45 58 v16 M50 58 v16 M55 58 v16" stroke={HD} strokeWidth={1} opacity={0.35} />
          <Path d="M36 59 q-1 -10 8 -12 q1 -9 9 -8 q9 -1 9 9 q7 3 4 11 z" fill={H} />
          <Circle cx={50} cy={35} r={3.6} fill={HP} />
          <Path d="M50 35 q3 -4 5.5 -3.5" fill="none" stroke={HD} strokeWidth={1.6} strokeLinecap="round" />
        </G>
      );
    case "dessert":
      return (
        <G>
          <Circle cx={43} cy={44} r={8.5} fill={H} />
          <Circle cx={57} cy={44} r={8.5} fill={HS} />
          <Circle cx={50} cy={37} r={8.5} fill={HP} />
          <Path d="M41.5 50 h17 l-8.5 24 z" fill={HP} stroke={H} strokeWidth={2.4} strokeLinejoin="round" />
          <Path d="M46 52 l2.5 8 M54 52 l-2.5 8 M50 51 v10" stroke={H} strokeWidth={1} opacity={0.4} />
        </G>
      );
    case "breakfast":
      return (
        <G>
          <Circle cx={50} cy={53} r={24} fill={CARD} stroke={HS} strokeWidth={3} />
          <Path d="M39 49 q-5 -8 4 -10 q3 -7 10 -4 q9 -3 11 6 q7 5 -1 11 q3 9 -8 8 q-8 4 -12 -4 q-9 1 -8 -7 z" fill={HP} />
          <Circle cx={46} cy={50} r={6.5} fill={H} />
        </G>
      );
    case "bread":
      return (
        <G>
          <Path d="M30 46 a20 12 0 0 1 40 0 z" fill={HS} />
          <Circle cx={41} cy={41} r={1.4} fill={CARD} />
          <Circle cx={50} cy={39} r={1.4} fill={CARD} />
          <Circle cx={59} cy={41} r={1.4} fill={CARD} />
          <Path d="M30 46 h40 v4 h-40 z" fill={H} />
          <Path d="M29 50 q21 6 42 0 v2 q-21 6 -42 0 z" fill={HP} />
          <Path d="M30 54 h40 v2 a20 8 0 0 1 -40 0 z" fill={HS} />
        </G>
      );
    case "salad":
      return (
        <G>
          <Circle cx={41} cy={45} r={8} fill={HS} />
          <Circle cx={56} cy={44} r={8} fill={HP} />
          <Circle cx={49} cy={49} r={8.5} fill={H} />
          <Path d="M28 51 h44 a22 15 0 0 1 -44 0 z" fill={H} />
          <Ellipse cx={50} cy={51} rx={22} ry={4} fill={HS} />
        </G>
      );
    case "main":
      return (
        <G>
          <Circle cx={50} cy={50} r={20} fill={CARD} stroke={HS} strokeWidth={3} />
          <Circle cx={50} cy={50} r={11} fill={HP} />
          <Path d="M17 32 v9 M20 32 v9 M23 32 v9" stroke={H} strokeWidth={2.3} strokeLinecap="round" />
          <Path d="M20 41 v27" stroke={H} strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M80 32 q5 1 5 9 v27" fill="none" stroke={H} strokeWidth={3.4} strokeLinecap="round" />
        </G>
      );
    case "pizza":
      return (
        <G>
          <Path d="M50 27 l18 40 a42 42 0 0 1 -36 0 z" fill={HP} stroke={H} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M32 67 a42 42 0 0 1 36 0" fill="none" stroke={H} strokeWidth={5} strokeLinecap="round" />
          <Circle cx={46} cy={53} r={3.2} fill={H} />
          <Circle cx={55} cy={58} r={3.2} fill={H} />
          <Circle cx={49} cy={63} r={3.2} fill={H} />
        </G>
      );
    default:
      return (
        <G>
          <Circle cx={50} cy={50} r={21} fill={CARD} stroke={HS} strokeWidth={3} />
          <Circle cx={50} cy={50} r={11.5} fill={HP} />
          <Path d="M30 36 v8 M33 36 v8 M31.5 44 v18" stroke={H} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M68 36 q4 1 4 7 v19" fill="none" stroke={H} strokeWidth={2.8} strokeLinecap="round" />
        </G>
      );
  }
}

/** A single default illustration, sized and rounded like PhotoPlaceholder. */
export function MenuArt({
  id,
  width,
  height,
  radius = 12,
}: {
  id: MenuArtId;
  width: number | "100%";
  height: number;
  radius?: number;
}) {
  const theme = useTheme();
  return (
    <View
      // Decorative: the dish name is always adjacent, so announcing the art
      // would just add noise. Matches PhotoPlaceholder.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius, backgroundColor: theme.harissaTint, overflow: "hidden" }}
    >
      <Svg width="100%" height={height} viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid slice">
        <Rect width={100} height={100} fill={theme.harissaTint} />
        {artFor(id, theme)}
      </Svg>
    </View>
  );
}

/**
 * The image for a menu item or category: the uploaded photo when there is one,
 * otherwise the venue's chosen default — a matched illustration, the woven
 * pattern, or a plain tint. Mirrors `MenuImage` in the web app.
 */
export function MenuImage({
  src,
  name,
  art,
  fallbackName,
  imageStyle,
  width,
  height,
  radius = 12,
  mirrored = false,
}: {
  src?: string | null;
  name: I18nText;
  art?: string | null;
  /** Parent category name, used when the item's own name is inconclusive. */
  fallbackName?: I18nText | null;
  imageStyle: ImageStyle;
  width: number | "100%";
  height: number;
  radius?: number;
  mirrored?: boolean;
}) {
  const theme = useTheme();
  if (src) return <PhotoPlaceholder width={width} height={height} radius={radius} mirrored={mirrored} src={src} />;
  if (imageStyle === "plain") {
    return <View style={{ width, height, borderRadius: radius, backgroundColor: theme.harissaTint }} />;
  }
  if (imageStyle === "pattern") {
    return <PhotoPlaceholder width={width} height={height} radius={radius} mirrored={mirrored} />;
  }
  return <MenuArt id={resolveMenuArt(art, name, fallbackName)} width={width} height={height} radius={radius} />;
}
