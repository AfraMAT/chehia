import { describe, expect, it } from "vitest";
import { itemCount } from "../plural";
import { ar, en, fr } from "../i18n";

describe("itemCount", () => {
  it("uses the singular for one — the bug this replaced rendered '1 items'", () => {
    expect(itemCount(1, en)).toBe("1 item");
    expect(itemCount(1, fr)).toBe("1 article");
  });

  it("uses the plural above one", () => {
    expect(itemCount(2, en)).toBe("2 items");
    expect(itemCount(9, fr)).toBe("9 articles");
  });

  it("keeps French's singular for zero", () => {
    // French writes "0 article"; the count>1 rule gives that for free.
    expect(itemCount(0, fr)).toBe("0 article");
  });

  it("renders in all three languages without an empty label", () => {
    for (const dict of [fr, ar, en]) {
      for (const n of [1, 2, 12]) {
        expect(itemCount(n, dict).trim().length, `${n}`).toBeGreaterThan(String(n).length);
      }
    }
  });
});
