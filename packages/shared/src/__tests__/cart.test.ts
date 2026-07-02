import { describe, expect, it } from "vitest";
import {
  addLine,
  buildLine,
  cartCount,
  cartTotal,
  emptyCart,
  reconcileCart,
  setQty,
  toOrderPayload,
  validateModifiers,
} from "../cart";
import type { MenuItem, ModifierGroup } from "../types";

const cappuccino: MenuItem = {
  id: "item-1",
  restaurant_id: "r1",
  category_id: "c1",
  name_i18n: { fr: "Cappuccino" },
  description_i18n: {},
  price_millimes: 5500,
  photo_url: null,
  is_available: true,
  is_popular: true,
  allergens: ["milk"],
  dietary_tags: ["vegetarian"],
  sort_order: 0,
};

const sizeGroup: ModifierGroup = {
  id: "g-size",
  item_id: "item-1",
  name_i18n: { fr: "Taille" },
  min_select: 1,
  max_select: 1,
  sort_order: 0,
  modifiers: [
    { id: "m-s", group_id: "g-size", name_i18n: { fr: "S" }, price_delta_millimes: 0, is_available: true, sort_order: 0 },
    { id: "m-l", group_id: "g-size", name_i18n: { fr: "L" }, price_delta_millimes: 1800, is_available: true, sort_order: 2 },
  ],
};

const extrasGroup: ModifierGroup = {
  id: "g-extras",
  item_id: "item-1",
  name_i18n: { fr: "Extras" },
  min_select: 0,
  max_select: 2,
  sort_order: 1,
  modifiers: [
    { id: "m-shot", group_id: "g-extras", name_i18n: { fr: "Double shot" }, price_delta_millimes: 1200, is_available: true, sort_order: 0 },
    { id: "m-almond", group_id: "g-extras", name_i18n: { fr: "Lait d'amande" }, price_delta_millimes: 1500, is_available: true, sort_order: 1 },
    { id: "m-cinnamon", group_id: "g-extras", name_i18n: { fr: "Cannelle" }, price_delta_millimes: 500, is_available: true, sort_order: 2 },
  ],
};

describe("buildLine", () => {
  it("prices base + modifier deltas (L cappuccino = 7,3 TND, matching the design)", () => {
    const line = buildLine(cappuccino, [sizeGroup], ["m-l"], 1);
    expect(line.unitPriceMillimes).toBe(7300);
  });
  it("collects modifier labels for display", () => {
    const line = buildLine(cappuccino, [sizeGroup, extrasGroup], ["m-l", "m-shot"], 2);
    expect(line.unitPriceMillimes).toBe(5500 + 1800 + 1200);
    expect(line.modifierLabels).toHaveLength(2);
  });
});

describe("cart operations", () => {
  it("merges identical lines and keeps distinct ones apart", () => {
    let cart = emptyCart("r1", "tok");
    const a = buildLine(cappuccino, [sizeGroup], ["m-l"], 1);
    const b = buildLine(cappuccino, [sizeGroup], ["m-l"], 1);
    const c = buildLine(cappuccino, [sizeGroup], ["m-s"], 1);
    cart = addLine(cart, a);
    cart = addLine(cart, b);
    cart = addLine(cart, c);
    expect(cart.lines).toHaveLength(2);
    expect(cartCount(cart)).toBe(3);
  });

  it("separates lines with different notes", () => {
    let cart = emptyCart("r1", "tok");
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-s"], 1, "bien chaud"));
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-s"], 1, ""));
    expect(cart.lines).toHaveLength(2);
  });

  it("computes the total across lines", () => {
    let cart = emptyCart("r1", "tok");
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-l"], 2)); // 2 × 7300
    expect(cartTotal(cart)).toBe(14600);
  });

  it("removes a line when qty drops to zero", () => {
    let cart = emptyCart("r1", "tok");
    const line = buildLine(cappuccino, [sizeGroup], ["m-s"], 1);
    cart = addLine(cart, line);
    cart = setQty(cart, line.key, 0);
    expect(cart.lines).toHaveLength(0);
  });

  it("caps qty at 20 (server rule)", () => {
    let cart = emptyCart("r1", "tok");
    const line = buildLine(cappuccino, [sizeGroup], ["m-s"], 1);
    cart = addLine(cart, line);
    cart = setQty(cart, line.key, 99);
    expect(cart.lines[0]?.qty).toBe(20);
  });

  it("caps merged quantities at 20 too", () => {
    let cart = emptyCart("r1", "tok");
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-s"], 15));
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-s"], 10));
    expect(cart.lines[0]?.qty).toBe(20);
  });
});

describe("reconcileCart", () => {
  it("reprices kept lines from fresh menu data", () => {
    let cart = emptyCart("r1", "tok");
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-l"], 2)); // 7300 each
    const repriced = { ...cappuccino, price_millimes: 6000 }; // price changed since
    const { cart: next, dropped } = reconcileCart(cart, [repriced], { "item-1": [sizeGroup] });
    expect(dropped).toBe(0);
    expect(next.lines[0]?.unitPriceMillimes).toBe(6000 + 1800);
  });

  it("drops lines whose item vanished or went unavailable", () => {
    let cart = emptyCart("r1", "tok");
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-s"], 1));
    const soldOut = { ...cappuccino, is_available: false };
    expect(reconcileCart(cart, [soldOut], { "item-1": [sizeGroup] }).dropped).toBe(1);
    expect(reconcileCart(cart, [], {}).dropped).toBe(1);
  });

  it("drops lines whose selected modifier no longer exists", () => {
    let cart = emptyCart("r1", "tok");
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-l"], 1));
    const groupWithoutL = { ...sizeGroup, modifiers: sizeGroup.modifiers.filter((m) => m.id !== "m-l") };
    const { dropped } = reconcileCart(cart, [cappuccino], { "item-1": [groupWithoutL] });
    expect(dropped).toBe(1);
  });
});

describe("validateModifiers", () => {
  it("fails when a required group has no selection", () => {
    const v = validateModifiers([sizeGroup, extrasGroup], []);
    expect(v.ok).toBe(false);
    expect(v.missingGroups).toEqual(["g-size"]);
  });
  it("fails when exceeding max_select", () => {
    const v = validateModifiers([sizeGroup, extrasGroup], ["m-s", "m-shot", "m-almond", "m-cinnamon"]);
    expect(v.ok).toBe(false);
    expect(v.overGroups).toEqual(["g-extras"]);
  });
  it("passes a valid selection", () => {
    const v = validateModifiers([sizeGroup, extrasGroup], ["m-l", "m-shot"]);
    expect(v.ok).toBe(true);
  });
});

describe("toOrderPayload", () => {
  it("produces the place-order edge function shape", () => {
    let cart = emptyCart("r1", "demo-elmarsa-t12");
    cart = addLine(cart, buildLine(cappuccino, [sizeGroup], ["m-l"], 2, "sans sucre"));
    cart = { ...cart, note: "Bambalouni bien chauds" };
    const payload = toOrderPayload(cart, "fr");
    expect(payload).toEqual({
      qr_token: "demo-elmarsa-t12",
      language: "fr",
      note: "Bambalouni bien chauds",
      lines: [{ item_id: "item-1", qty: 2, modifier_ids: ["m-l"], note: "sans sucre" }],
    });
  });
});
