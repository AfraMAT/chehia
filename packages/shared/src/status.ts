import type { OrderStatus } from "./types";

/** Order lifecycle: new → preparing → ready → served (cancel from new/preparing). */
export const ORDER_FLOW: OrderStatus[] = ["new", "preparing", "ready", "served"];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "served", "cancelled"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const idx = ORDER_FLOW.indexOf(status);
  if (idx === -1 || idx === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[idx + 1] ?? null;
}

export function isOpen(status: OrderStatus): boolean {
  return status === "new" || status === "preparing" || status === "ready";
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "served" || status === "cancelled";
}

/** Progress step index for the customer tracking timeline (0..2, or -1 cancelled). */
export function trackingStep(status: OrderStatus): number {
  switch (status) {
    case "new":
      return 0;
    case "preparing":
      return 1;
    case "ready":
      return 1; // customer view groups ready with preparing ("on l'apporte")
    case "served":
      return 2;
    case "cancelled":
      return -1;
  }
}
