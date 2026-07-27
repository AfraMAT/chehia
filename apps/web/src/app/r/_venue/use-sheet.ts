"use client";

import { useEffect, useRef } from "react";

/**
 * Modal semantics for the bottom sheets: Escape closes, the page behind stops
 * scrolling, and focus returns to whatever opened the sheet. Anything rendering
 * `role="dialog" aria-modal="true"` must call this — `aria-modal` tells assistive
 * tech the rest of the page is inert, so it has to actually behave that way.
 *
 * `onClose` is held in a ref so the lock/restore runs exactly once per open:
 * callers pass inline arrows, and re-running the effect would yank focus back to
 * the trigger on every parent render.
 *
 * (item-sheet / table-picker / rating-sheet / waiter-sheet still inline the same
 * effect; this is the shared version.)
 */
export function useSheet(onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);
}
