import { describe, expect, it } from "vitest";
import { MENU_ART_IDS, coerceArtId, pickMenuArt, resolveMenuArt } from "../menu-art";

describe("pickMenuArt", () => {
  it("matches by keyword across languages", () => {
    expect(pickMenuArt({ fr: "Cappuccino" })).toBe("coffee");
    expect(pickMenuArt({ fr: "Thé à la menthe" })).toBe("tea");
    expect(pickMenuArt({ fr: "Jus d'orange" })).toBe("juice");
    expect(pickMenuArt({ fr: "Pâtisseries" })).toBe("pastry");
    expect(pickMenuArt({ ar: "حلويات" })).toBe("dessert");
    expect(pickMenuArt({ en: "Margherita Pizza" })).toBe("pizza");
    expect(pickMenuArt({ fr: "Salade méchouia" })).toBe("salad");
  });

  it("falls back to generic for unknown names", () => {
    expect(pickMenuArt({ fr: "Direct" })).toBe("generic");
    expect(pickMenuArt({})).toBe("generic");
    expect(pickMenuArt(null)).toBe("generic");
  });
});

describe("resolveMenuArt", () => {
  it("prefers an explicit valid art id", () => {
    expect(resolveMenuArt("pizza", { fr: "Cappuccino" })).toBe("pizza");
    expect(resolveMenuArt("nonsense", { fr: "Cappuccino" })).toBe("coffee");
  });

  it("uses the category fallback when the item name is inconclusive", () => {
    // "Direct" alone → generic; under "Cafés" → coffee.
    expect(resolveMenuArt(null, { fr: "Direct" })).toBe("generic");
    expect(resolveMenuArt(null, { fr: "Direct" }, { fr: "Cafés" })).toBe("coffee");
  });

  it("does not override a good name match with the fallback", () => {
    expect(resolveMenuArt(null, { fr: "Cappuccino" }, { fr: "Pâtisseries" })).toBe("coffee");
  });
});

describe("coerceArtId", () => {
  it("accepts known ids only", () => {
    expect(coerceArtId("coffee")).toBe("coffee");
    expect(coerceArtId("banana")).toBeNull();
    expect(coerceArtId(null)).toBeNull();
    expect(MENU_ART_IDS).toContain("generic");
  });
});
