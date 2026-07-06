"use client";

import { useCallback } from "react";
import { useI18n } from "@/components/i18n-provider";

/**
 * Localize a stock unit code (piece, kg, bottle…). Units are free text in the
 * DB, so an unknown/custom code renders as-is. Returned as a stable callback.
 */
export function useInventoryUnit() {
  const { t } = useI18n();
  const units = t.portal.inventory.units as Record<string, string>;
  return useCallback((code: string) => units[code] ?? code, [units]);
}

/** Localize a category code (food, drinks, supplies, other), else render as-is. */
export function useInventoryCategory() {
  const { t } = useI18n();
  const cats = t.portal.inventory.categories as Record<string, string>;
  return useCallback((code: string) => cats[code] ?? code, [cats]);
}
