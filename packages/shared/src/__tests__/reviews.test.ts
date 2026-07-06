import { describe, expect, it } from "vitest";
import {
  SENTIMENT_RATING,
  formatRating,
  formatRelativeTime,
  sentimentToRating,
  starFills,
} from "../reviews";

describe("sentiment → star mapping", () => {
  it("maps the three faces to 5 / 4 / 2", () => {
    expect(sentimentToRating("love")).toBe(5);
    expect(sentimentToRating("good")).toBe(4);
    expect(sentimentToRating("meh")).toBe(2);
    expect(SENTIMENT_RATING).toEqual({ love: 5, good: 4, meh: 2 });
  });
});

describe("starFills", () => {
  it("fully fills whole stars", () => {
    expect(starFills(5)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(0)).toEqual([0, 0, 0, 0, 0]);
  });
  it("partially fills the fractional star", () => {
    expect(starFills(4.3)).toEqual([1, 1, 1, 1, expect.closeTo(0.3, 5)]);
    expect(starFills(2.5)).toEqual([1, 1, expect.closeTo(0.5, 5), 0, 0]);
  });
  it("clamps out-of-range and null", () => {
    expect(starFills(null)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(9)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(-2)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("formatRating", () => {
  it("one decimal, locale separator", () => {
    expect(formatRating(4.25, "fr")).toBe("4,3");
    expect(formatRating(4.25, "en")).toBe("4.3");
    expect(formatRating(5, "ar")).toBe("5,0");
    expect(formatRating(null)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-05T12:00:00Z");
  it("buckets recent → months", () => {
    expect(formatRelativeTime("2026-07-05T11:59:30Z", "fr", now)).toBe("à l'instant");
    expect(formatRelativeTime("2026-07-05T11:30:00Z", "fr", now)).toBe("il y a 30 min");
    expect(formatRelativeTime("2026-07-05T09:00:00Z", "fr", now)).toBe("il y a 3 h");
    expect(formatRelativeTime("2026-07-04T10:00:00Z", "fr", now)).toBe("hier");
    expect(formatRelativeTime("2026-06-30T12:00:00Z", "fr", now)).toBe("il y a 5 j");
  });
  it("localizes", () => {
    expect(formatRelativeTime("2026-07-05T11:30:00Z", "en", now)).toBe("30 min ago");
    expect(formatRelativeTime("2026-07-04T10:00:00Z", "ar", now)).toBe("أمس");
  });
});
