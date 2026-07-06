import { describe, expect, it } from "vitest";
import {
  formatQty,
  stockLevel,
  stockLevelRank,
  stockValueMillimes,
  suggestReorderQty,
  MANUAL_MOVEMENT_TYPES,
  MOVEMENT_SIGN,
} from "../inventory";

describe("stockLevel", () => {
  it("is 'out' at or below zero", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(-1, 5)).toBe("out");
  });
  it("is 'low' at or below a positive threshold", () => {
    expect(stockLevel(5, 5)).toBe("low");
    expect(stockLevel(4.999, 5)).toBe("low");
  });
  it("is 'ok' above the threshold", () => {
    expect(stockLevel(6, 5)).toBe("ok");
  });
  it("never flags a zero threshold as low (only out matters)", () => {
    expect(stockLevel(0.001, 0)).toBe("ok");
    expect(stockLevel(0, 0)).toBe("out");
  });
  it("untracked items are always ok", () => {
    expect(stockLevel(0, 5, false)).toBe("ok");
    expect(stockLevel(-3, 5, false)).toBe("ok");
  });
  it("ranks worsen ok < low < out", () => {
    expect(stockLevelRank("ok")).toBeLessThan(stockLevelRank("low"));
    expect(stockLevelRank("low")).toBeLessThan(stockLevelRank("out"));
  });
});

describe("formatQty", () => {
  it("trims trailing zeros", () => {
    expect(formatQty(4)).toBe("4");
    expect(formatQty(19.0)).toBe("19");
    expect(formatQty(1.2)).toBe("1,2");
  });
  it("keeps meaningful decimals", () => {
    expect(formatQty(0.25)).toBe("0,25");
    expect(formatQty(0.205)).toBe("0,205");
  });
  it("uses a dot for English, comma otherwise", () => {
    expect(formatQty(1.5, "en")).toBe("1.5");
    expect(formatQty(1.5, "ar")).toBe("1,5");
  });
  it("handles zero, negatives and nullish", () => {
    expect(formatQty(0)).toBe("0");
    expect(formatQty(-1)).toBe("-1");
    expect(formatQty(null)).toBe("0");
    expect(formatQty(undefined)).toBe("0");
    expect(formatQty(Number.NaN)).toBe("0");
  });
  it("rounds to 3 decimals", () => {
    expect(formatQty(1.23456)).toBe("1,235");
  });
});

describe("suggestReorderQty", () => {
  it("returns par minus on-hand", () => {
    expect(suggestReorderQty({ qty_on_hand: 4, par_level: 20 })).toBe(16);
  });
  it("never goes negative", () => {
    expect(suggestReorderQty({ qty_on_hand: 25, par_level: 20 })).toBe(0);
  });
  it("is null without a par level", () => {
    expect(suggestReorderQty({ qty_on_hand: 4, par_level: null })).toBeNull();
    expect(suggestReorderQty({ qty_on_hand: 4, par_level: undefined })).toBeNull();
  });
});

describe("stockValueMillimes", () => {
  it("multiplies on-hand by unit cost", () => {
    expect(stockValueMillimes({ qty_on_hand: 4, unit_cost_millimes: 1800 })).toBe(7200);
  });
  it("clamps a negative (oversold) on-hand to zero value", () => {
    expect(stockValueMillimes({ qty_on_hand: -2, unit_cost_millimes: 1800 })).toBe(0);
  });
  it("is zero without a unit cost", () => {
    expect(stockValueMillimes({ qty_on_hand: 4, unit_cost_millimes: null })).toBe(0);
  });
});

describe("movement metadata", () => {
  it("exposes the four manual movement types", () => {
    expect(MANUAL_MOVEMENT_TYPES).toEqual(["receive", "waste", "adjustment", "count"]);
  });
  it("signs each type sensibly", () => {
    expect(MOVEMENT_SIGN.receive).toBe("add");
    expect(MOVEMENT_SIGN.sale).toBe("remove");
    expect(MOVEMENT_SIGN.count).toBe("set");
    expect(MOVEMENT_SIGN.adjustment).toBe("signed");
  });
});
