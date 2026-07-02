import { describe, expect, it } from "vitest";
import { canTransition, isOpen, isTerminal, nextStatus, trackingStep } from "../status";

describe("order status machine", () => {
  it("follows new → preparing → ready → served", () => {
    expect(nextStatus("new")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("ready");
    expect(nextStatus("ready")).toBe("served");
    expect(nextStatus("served")).toBeNull();
  });

  it("allows cancellation only before ready", () => {
    expect(canTransition("new", "cancelled")).toBe(true);
    expect(canTransition("preparing", "cancelled")).toBe(true);
    expect(canTransition("ready", "cancelled")).toBe(false);
    expect(canTransition("served", "cancelled")).toBe(false);
  });

  it("allows skipping ready (small cafés serve directly)", () => {
    expect(canTransition("preparing", "served")).toBe(true);
  });

  it("rejects backwards transitions", () => {
    expect(canTransition("served", "preparing")).toBe(false);
    expect(canTransition("ready", "new")).toBe(false);
  });

  it("classifies open vs terminal", () => {
    expect(isOpen("new")).toBe(true);
    expect(isOpen("ready")).toBe(true);
    expect(isTerminal("served")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  it("maps to customer tracking steps", () => {
    expect(trackingStep("new")).toBe(0);
    expect(trackingStep("preparing")).toBe(1);
    expect(trackingStep("served")).toBe(2);
    expect(trackingStep("cancelled")).toBe(-1);
  });
});
