import { describe, expect, it } from "vitest";
import { ar, en, fr, getDictionary, interpolate } from "../i18n";
import { isRtl, tr } from "../types";

function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? collectKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("dictionaries", () => {
  it("ar and en cover exactly the same keys as fr", () => {
    const frKeys = collectKeys(fr).sort();
    expect(collectKeys(ar).sort()).toEqual(frKeys);
    expect(collectKeys(en).sort()).toEqual(frKeys);
  });

  it("no empty strings anywhere", () => {
    for (const dict of [fr, ar, en]) {
      const walk = (o: Record<string, unknown>) => {
        for (const v of Object.values(o)) {
          if (typeof v === "string") expect(v.length).toBeGreaterThan(0);
          else walk(v as Record<string, unknown>);
        }
      };
      walk(dict);
    }
  });

  it("placeholders survive in all languages", () => {
    expect(fr.order.remaining).toContain("{min}");
    expect(ar.order.remaining).toContain("{min}");
    expect(en.order.remaining).toContain("{min}");
  });

  it("falls back to fr for unknown languages", () => {
    // @ts-expect-error deliberately wrong
    expect(getDictionary("de")).toBe(fr);
  });
});

describe("interpolate", () => {
  it("replaces placeholders", () => {
    expect(interpolate("Encore ~{min} min", { min: 8 })).toBe("Encore ~8 min");
  });
  it("leaves unknown placeholders visible", () => {
    expect(interpolate("{oops}", {})).toBe("{oops}");
  });
});

describe("tr / isRtl", () => {
  it("resolves the requested language with fr fallback", () => {
    expect(tr({ fr: "Cafés", ar: "القهوة" }, "ar")).toBe("القهوة");
    expect(tr({ fr: "Cafés" }, "en")).toBe("Cafés");
    expect(tr(null, "fr")).toBe("");
  });
  it("marks only Arabic as RTL", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("fr")).toBe(false);
  });
});
