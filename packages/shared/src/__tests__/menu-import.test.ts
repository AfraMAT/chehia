import { describe, expect, it } from "vitest";
import { parseMenuPrice, validateDraft } from "../menu-import";

describe("parseMenuPrice", () => {
  const cases: [string, number | null][] = [
    ["3,500", 3500],
    ["3.500", 3500],
    ["3,5", 3500],
    ["3.5", 3500],
    ["3500", 3500],
    ["3", 3000],
    ["12,000", 12000],
    ["0,500", 500],
    ["1 500", 1500],
    ["3,500 DT", 3500],
    ["3.5 TND", 3500],
    ["3500 millimes", 3500],
    ["12", 12000],
    ["", null],
    ["SAISON", null],
    ["—", null],
    ["prix du marché", null],
    ["-2", null],
    ["abc", null],
    ["3,5,5", null],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(parseMenuPrice(input)).toBe(expected);
    });
  }
});

describe("validateDraft", () => {
  it("keeps only the venue's languages and flags a missing price", () => {
    const raw = {
      source_language: "fr",
      categories: [
        {
          name_i18n: { fr: "Cafés", ar: "قهوة", en: "Coffee" },
          items: [
            { name_i18n: { fr: "Express", ar: "اكسبرس", en: "Espresso" }, price_millimes: 2800 },
            { name_i18n: { fr: "Direct", en: "Direct" }, price_millimes: 0 },
          ],
        },
      ],
    };
    const { ok, draft, issues } = validateDraft(raw, ["fr", "ar"]);
    expect(ok).toBe(true);
    expect(draft.categories).toHaveLength(1);
    // "en" dropped for a fr/ar venue.
    expect(draft.categories[0]!.name_i18n).toEqual({ fr: "Cafés", ar: "قهوة" });
    expect(draft.categories[0]!.items[0]!.name_i18n.en).toBeUndefined();
    expect(issues).toContain("missing_price");
  });

  it("drops items with no name in any venue language", () => {
    const raw = {
      categories: [{ name_i18n: { fr: "X" }, items: [{ name_i18n: { de: "Kaffee" }, price_millimes: 1000 }] }],
    };
    const { draft } = validateDraft(raw, ["fr"]);
    expect(draft.categories[0]!.items).toHaveLength(0);
  });

  it("reports no_items on an empty/garbage draft", () => {
    expect(validateDraft({ categories: [] }, ["fr"]).issues).toContain("no_items");
    expect(validateDraft(null, ["fr"]).ok).toBe(false);
    expect(validateDraft("nope", ["fr"]).ok).toBe(false);
  });

  it("defaults source_language to fr when absent/invalid", () => {
    expect(validateDraft({ categories: [] }, ["fr"]).draft.source_language).toBe("fr");
    expect(validateDraft({ source_language: "zz", categories: [] }, ["fr"]).draft.source_language).toBe("fr");
  });
});
