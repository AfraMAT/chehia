import type { CartLine } from "@chehia/shared";
import { txt } from "./util";

/**
 * Ticket de caisse — the pure data shape of a fiscal receipt, assembled at
 * settle time. Both the on-screen preview (ReceiptView) and, later, the ESC/POS
 * thermal encoder render from this exact structure. Amounts are millimes.
 */
export interface ReceiptLine {
  name: string;
  qty: number;
  unitMillimes: number;
  totalMillimes: number;
  mods: string[];
}

export interface ReceiptData {
  venueName: string;
  address: string;
  city: string;
  phone: string;
  matricule: string;
  orderNumber: string;
  fiscalNumber: string;
  dateISO: string;
  orderTypeLabel: string;
  tableLabel: string;
  staffName: string;
  lines: ReceiptLine[];
  subtotalMillimes: number;
  taxMillimes: number;
  tvaRate: number;
  timbreMillimes: number;
  roundingMillimes: number;
  totalMillimes: number;
  method: string;
  tenderedMillimes: number | null;
  changeMillimes: number;
  footer: string;
}

export function buildReceiptData(input: {
  restaurant: { name: string; address: string; city: string; phone: string };
  fiscal: { matricule_fiscal?: string; receipt_footer?: string } | null;
  lines: CartLine[];
  subtotalMillimes: number;
  orderNumber: string;
  fiscalNumber: string;
  orderTypeLabel: string;
  tableLabel: string;
  staffName: string;
  method: string;
  tenderedMillimes: number | null;
  amountMillimes: number;
  taxMillimes: number;
  tvaRate: number;
  timbreMillimes: number;
  roundingMillimes: number;
  changeMillimes: number;
  dateISO: string;
}): ReceiptData {
  return {
    venueName: input.restaurant.name,
    address: input.restaurant.address ?? "",
    city: input.restaurant.city ?? "",
    phone: input.restaurant.phone ?? "",
    matricule: input.fiscal?.matricule_fiscal ?? "",
    orderNumber: input.orderNumber,
    fiscalNumber: input.fiscalNumber,
    dateISO: input.dateISO,
    orderTypeLabel: input.orderTypeLabel,
    tableLabel: input.tableLabel,
    staffName: input.staffName,
    lines: input.lines.map((l) => ({
      name: txt(l.name),
      qty: l.qty,
      unitMillimes: l.unitPriceMillimes,
      totalMillimes: l.unitPriceMillimes * l.qty,
      mods: l.modifierLabels.map((m) => txt(m.choice)),
    })),
    subtotalMillimes: input.subtotalMillimes,
    taxMillimes: input.taxMillimes,
    tvaRate: input.tvaRate,
    timbreMillimes: input.timbreMillimes,
    roundingMillimes: input.roundingMillimes,
    totalMillimes: input.amountMillimes,
    method: input.method,
    tenderedMillimes: input.tenderedMillimes,
    changeMillimes: input.changeMillimes,
    footer: input.fiscal?.receipt_footer || "Merci de votre visite !",
  };
}
