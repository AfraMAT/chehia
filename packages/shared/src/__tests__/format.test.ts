import { describe, expect, it } from "vitest";
import { currencyLabel, formatDelta, formatPrice, formatTimer, millimesToDisplay } from "../format";

describe("millimesToDisplay", () => {
  it("keeps at least one decimal, matching the design (6,0 TND)", () => {
    expect(millimesToDisplay(6000, "fr")).toBe("6,0");
  });
  it("trims trailing zeros beyond the first decimal", () => {
    expect(millimesToDisplay(5500, "fr")).toBe("5,5");
    expect(millimesToDisplay(2800, "fr")).toBe("2,8");
    expect(millimesToDisplay(27600, "fr")).toBe("27,6");
  });
  it("keeps full millime precision when needed", () => {
    expect(millimesToDisplay(5550, "fr")).toBe("5,55");
    expect(millimesToDisplay(5555, "fr")).toBe("5,555");
  });
  it("uses a dot for English", () => {
    expect(millimesToDisplay(27600, "en")).toBe("27.6");
  });
  it("uses a comma with western numerals for Arabic", () => {
    expect(millimesToDisplay(13300, "ar")).toBe("13,3");
  });
  it("handles zero", () => {
    expect(millimesToDisplay(0, "fr")).toBe("0,0");
  });
  it("handles negatives", () => {
    expect(millimesToDisplay(-1500, "fr")).toBe("−1,5");
  });
});

describe("formatPrice / currencyLabel", () => {
  it("formats with TND for latin scripts", () => {
    expect(formatPrice(5500, "fr")).toBe("5,5 TND");
    expect(formatPrice(5500, "en")).toBe("5.5 TND");
  });
  it("formats with د.ت for Arabic", () => {
    expect(currencyLabel("ar")).toBe("د.ت");
    expect(formatPrice(5500, "ar")).toBe("5,5 د.ت");
  });
});

describe("formatDelta", () => {
  it("shows +1,0 style deltas", () => {
    expect(formatDelta(1000, "fr")).toBe("+1,0");
    expect(formatDelta(1800, "fr")).toBe("+1,8");
  });
  it("is empty for zero", () => {
    expect(formatDelta(0, "fr")).toBe("");
  });
});

describe("formatTimer", () => {
  it("formats m:ss", () => {
    const now = new Date("2026-07-01T12:04:12Z");
    const since = new Date("2026-07-01T12:00:00Z").toISOString();
    expect(formatTimer(since, now)).toBe("4:12");
  });
});
