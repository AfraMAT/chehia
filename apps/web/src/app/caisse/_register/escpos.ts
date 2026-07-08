import { currencyLabel, millimesToDisplay } from "@chehia/shared";
import type { ReceiptData } from "./receipt-types";

/**
 * ESC/POS encoder — turns a ReceiptData into the byte stream a thermal printer
 * understands. Pure and printer-agnostic; the transport (WebUSB / LAN) lives in
 * thermal-print.ts. Defaults to an 80mm roll (42 columns). Cheap printers vary in
 * codepage support, so accents are flattened to ASCII to stay legible everywhere.
 */

const ESC = 0x1b;
const GS = 0x1d;

const money = (m: number) => `${millimesToDisplay(m, "fr")} ${currencyLabel("fr")}`;

/** é→e, à→a … so a CP437-only printer doesn't print garbage. */
function ascii(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "");
}

class Builder {
  private parts: number[] = [];
  private enc = new TextEncoder();

  raw(...bytes: number[]) {
    this.parts.push(...bytes);
    return this;
  }
  text(s: string) {
    for (const b of this.enc.encode(ascii(s))) this.parts.push(b);
    return this;
  }
  line(s = "") {
    return this.text(s).raw(0x0a);
  }
  align(a: "left" | "center" | "right") {
    return this.raw(ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0);
  }
  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  /** GS ! — double width/height when big. */
  size(big: boolean) {
    return this.raw(GS, 0x21, big ? 0x11 : 0x00);
  }
  feed(n = 1) {
    for (let i = 0; i < n; i++) this.parts.push(0x0a);
    return this;
  }
  cut() {
    return this.raw(GS, 0x56, 0x42, 0x00); // feed + partial cut
  }
  /** Kick the cash drawer via the printer's pulse pin. */
  drawerKick() {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
  }
  bytes(): Uint8Array {
    return new Uint8Array(this.parts);
  }
}

/** A "label ............ value" row padded to `width` columns. */
function row(label: string, value: string, width: number): string {
  const l = ascii(label);
  const v = ascii(value);
  const space = Math.max(1, width - l.length - v.length);
  return l + " ".repeat(space) + v;
}

function rule(width: number): string {
  return "-".repeat(width);
}

export function encodeReceipt(data: ReceiptData, opts: { width?: number; openDrawer?: boolean } = {}): Uint8Array {
  const width = opts.width ?? 42;
  const b = new Builder();
  b.raw(ESC, 0x40); // init
  if (opts.openDrawer) b.drawerKick();

  // Header
  b.align("center").bold(true).size(true).line(data.venueName).size(false).bold(false);
  if (data.address) b.line(data.address);
  const cityPhone = [data.city, data.phone].filter(Boolean).join(" - ");
  if (cityPhone) b.line(cityPhone);
  if (data.matricule) b.line(`MF: ${data.matricule}`);
  b.feed();

  // Meta
  b.align("left");
  b.line(row("Recu No", data.fiscalNumber || "-", width));
  b.line(row("Ticket", data.orderNumber, width));
  b.line(row("Date", formatDate(data.dateISO), width));
  b.line(row(data.orderTypeLabel, data.tableLabel, width));
  b.line(row("Servi par", data.staffName, width));
  b.line(rule(width));

  // Lines
  for (const line of data.lines) {
    b.line(row(`${line.qty}x ${line.name}`, money(line.totalMillimes), width));
    if (line.mods.length > 0) b.line(`   ${line.mods.join(", ")}`);
  }
  b.line(rule(width));

  // Totals
  b.line(row("Sous-total", money(data.subtotalMillimes), width));
  if (data.taxMillimes > 0) b.line(row(`TVA ${data.tvaRate}%`, money(data.taxMillimes), width));
  if (data.timbreMillimes > 0) b.line(row("Timbre", money(data.timbreMillimes), width));
  if (data.roundingMillimes !== 0) b.line(row("Arrondi", money(data.roundingMillimes), width));
  b.bold(true).size(true).line(row("TOTAL", money(data.totalMillimes), Math.floor(width / 2))).size(false).bold(false);
  b.line(rule(width));

  // Tender
  b.line(row("Paiement", methodLabel(data.method), width));
  if (data.method === "cash" && data.tenderedMillimes !== null) {
    b.line(row("Recu", money(data.tenderedMillimes), width));
    b.line(row("Rendu", money(data.changeMillimes), width));
  }

  // Footer
  b.feed().align("center").line(data.footer).feed(3).cut();
  return b.bytes();
}

function methodLabel(m: string): string {
  return { cash: "Especes", card: "Carte", d17: "D17", other: "Autre" }[m] ?? m;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
