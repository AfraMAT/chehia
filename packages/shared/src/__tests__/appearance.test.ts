import { describe, expect, it } from "vitest";
import {
  BUILTIN_THEMES,
  DEFAULT_APPEARANCE,
  DEFAULT_PALETTE,
  appearanceCssVars,
  availableThemes,
  contrastRatio,
  ensureContrast,
  expandPalette,
  extractedPresetFromRaw,
  hexToRgb,
  mix,
  paletteToCssVars,
  resolveAppearance,
  resolveThemePalette,
  withExtractedPalette,
  type ThemePreset,
} from "../appearance";
import { buildCategoryTree, descendantCategoryIds, nodeItemCount } from "../menu-tree";
import type { Category } from "../types";

describe("color utils", () => {
  it("parses hex leniently", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("garbage")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("mixes at the midpoint", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("computes contrast extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("ensureContrast reaches at least the target ratio", () => {
    // low-contrast pair: light grey text on white
    const fixed = ensureContrast("#bbbbbb", "#ffffff", 4.5);
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    // and it lightens against a dark background
    const onDark = ensureContrast("#444444", "#111111", 4.5);
    expect(contrastRatio(onDark, "#111111")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("expandPalette", () => {
  it("keeps text tokens contrast-safe on both light and dark seeds", () => {
    for (const seed of [
      { primary: "#bc4b26", background: "#faf6ef", surface: "#fffdf9", text: "#221a13", accent: "#10606a" },
      { primary: "#e0894a", background: "#1a1712", surface: "#241f19", text: "#f4ede4", accent: "#6fb3ae" },
    ]) {
      const p = expandPalette(seed);
      expect(contrastRatio(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.muted, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.mutedSoft, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(p.primary).toBe(seed.primary);
      expect(p.bg).toBe(seed.background);
    }
  });
});

describe("resolveAppearance", () => {
  it("fills defaults for empty / garbage input", () => {
    expect(resolveAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(resolveAppearance({})).toEqual(DEFAULT_APPEARANCE);
    expect(resolveAppearance("nonsense")).toEqual(DEFAULT_APPEARANCE);
    expect(resolveAppearance(42)).toEqual(DEFAULT_APPEARANCE);
  });

  it("coerces invalid enums back to defaults but keeps valid overrides", () => {
    const a = resolveAppearance({ categoryLayout: "spiral", itemLayout: "cards", showCategoryLanding: false, themeId: "olive" });
    expect(a.categoryLayout).toBe("grid"); // invalid → default
    expect(a.itemLayout).toBe("cards"); // valid override kept
    expect(a.showCategoryLanding).toBe(false);
    expect(a.themeId).toBe("olive");
  });

  it("keeps only well-formed extracted palettes", () => {
    const good: ThemePreset = { id: "extracted-1", name_i18n: { fr: "Scan" }, palette: DEFAULT_PALETTE };
    const a = resolveAppearance({ extractedPalettes: [good, { id: "bad" }, "junk"] });
    expect(a.extractedPalettes).toHaveLength(1);
    expect(a.extractedPalettes?.[0]?.id).toBe("extracted-1");
  });
});

describe("resolveThemePalette", () => {
  it("returns the default palette for the default appearance", () => {
    expect(resolveThemePalette(DEFAULT_APPEARANCE)).toEqual(DEFAULT_PALETTE);
  });

  it("selects a built-in preset by id", () => {
    const olive = BUILTIN_THEMES.find((t) => t.id === "olive")!;
    expect(resolveThemePalette(resolveAppearance({ themeId: "olive" }))).toEqual(olive.palette);
  });

  it("falls back to default for an unknown themeId", () => {
    expect(resolveThemePalette(resolveAppearance({ themeId: "does-not-exist" }))).toEqual(DEFAULT_PALETTE);
  });

  it("merges a custom palette over the default", () => {
    const a = resolveAppearance({ themeId: "custom", customPalette: { primary: "#123456" } });
    const p = resolveThemePalette(a);
    expect(p.primary).toBe("#123456");
    expect(p.ink).toBe(DEFAULT_PALETTE.ink);
  });

  it("resolves an extracted palette referenced by themeId", () => {
    const preset: ThemePreset = { id: "extracted-1", name_i18n: {}, palette: expandPalette({ primary: "#884400", background: "#fff8f0", surface: "#ffffff", text: "#2a1c10", accent: "#116b60" }) };
    const a = resolveAppearance({ themeId: "extracted-1", extractedPalettes: [preset] });
    expect(availableThemes(a).map((t) => t.id)).toContain("extracted-1");
    expect(resolveThemePalette(a)).toEqual(preset.palette);
  });
});

describe("paletteToCssVars", () => {
  it("maps every token to a --color-* variable", () => {
    const vars = paletteToCssVars(DEFAULT_PALETTE);
    expect(vars["--color-harissa"]).toBe(DEFAULT_PALETTE.primary);
    expect(vars["--color-ink"]).toBe(DEFAULT_PALETTE.ink);
    expect(vars["--color-cream"]).toBe(DEFAULT_PALETTE.bg);
    expect(Object.keys(vars)).toHaveLength(Object.keys(DEFAULT_PALETTE).length);
  });

  it("appearanceCssVars resolves a raw blob straight to vars", () => {
    expect(appearanceCssVars({ themeId: "harissa" })["--color-harissa"]).toBe(DEFAULT_PALETTE.primary);
    expect(appearanceCssVars(null)["--color-cream"]).toBe(DEFAULT_PALETTE.bg);
  });
});

describe("extractedPresetFromRaw + withExtractedPalette", () => {
  const raw = { theme_name: "Terre cuite", primary: "#bc4b26", background: "#faf6ef", surface: "#ffffff", text: "#221a13", accent: "#10606a" };

  it("builds a preset from a valid palette", () => {
    const preset = extractedPresetFromRaw(raw, "extracted-1");
    expect(preset?.id).toBe("extracted-1");
    expect(preset?.palette.primary).toBe("#bc4b26");
    expect(preset?.name_i18n.fr).toBe("Terre cuite");
  });

  it("returns null when any seed color is missing/invalid", () => {
    expect(extractedPresetFromRaw({ ...raw, accent: "not-a-color" }, "x")).toBeNull();
    expect(extractedPresetFromRaw({ primary: "#000000" }, "x")).toBeNull();
    expect(extractedPresetFromRaw(null, "x")).toBeNull();
  });

  it("appends to appearance, dedups by id, and caps at 6", () => {
    const preset = extractedPresetFromRaw(raw, "extracted-1")!;
    let appearance = withExtractedPalette({}, preset);
    expect(appearance.extractedPalettes).toHaveLength(1);
    // re-adding the same id does not duplicate
    appearance = withExtractedPalette(appearance, preset);
    expect(appearance.extractedPalettes).toHaveLength(1);
    // cap at 6
    for (let i = 0; i < 10; i++) appearance = withExtractedPalette(appearance, { ...preset, id: `e-${i}` });
    expect(appearance.extractedPalettes!.length).toBeLessThanOrEqual(6);
  });
});

describe("buildCategoryTree", () => {
  const cat = (id: string, sort: number, parent_id: string | null = null): Category => ({
    id,
    restaurant_id: "r",
    name_i18n: { fr: id },
    sort_order: sort,
    is_active: true,
    parent_id,
    image_url: null,
    icon: null,
  });

  it("nests subcategories under their parent, in sort order", () => {
    const tree = buildCategoryTree([cat("b", 1), cat("a", 0), cat("a2", 1, "a"), cat("a1", 0, "a")]);
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
    expect(tree[0]!.children.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(descendantCategoryIds(tree[0]!)).toEqual(["a", "a1", "a2"]);
  });

  it("promotes orphans (missing parent) to top level", () => {
    const tree = buildCategoryTree([cat("child", 0, "gone")]);
    expect(tree.map((n) => n.id)).toEqual(["child"]);
  });

  it("counts items across a node and its children", () => {
    const tree = buildCategoryTree([cat("a", 0), cat("a1", 0, "a")]);
    expect(nodeItemCount(tree[0]!, { a: 3, a1: 2 })).toBe(5);
  });
});
