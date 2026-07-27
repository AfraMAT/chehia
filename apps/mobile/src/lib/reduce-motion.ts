import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Stack `animation` honouring the OS "Reduce Motion" accessibility setting.
 * Every <Stack> reads this, so transitions are suppressed on the whole ordering
 * flow — not just on the root stack. */
export function useStackAnimation(): "none" | "slide_from_right" {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  return reduceMotion ? "none" : "slide_from_right";
}
