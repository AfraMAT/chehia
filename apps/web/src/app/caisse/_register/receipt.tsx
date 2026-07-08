"use client";

import { interpolate } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse } from "../caisse-provider";
import { money } from "./util";
import type { ReceiptData } from "./receipt-types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * The ticket de caisse. Rendered ~72mm wide in monospace to mirror thermal paper.
 * The ESC/POS thermal path (task #24) will encode from the same ReceiptData.
 */
export function ReceiptView({ data }: { data: ReceiptData }) {
  const { t } = useI18n();
  const methodLabel: Record<string, string> = {
    cash: t.caisse.tender.cash,
    card: t.caisse.tender.card,
    d17: t.caisse.tender.d17,
    other: t.caisse.tender.other,
  };
  return (
    <div className="mx-auto w-[300px] max-w-full bg-white text-ink font-mono text-[12px] leading-snug px-5 py-5 border border-line rounded-lg">
      {/* Head */}
      <div className="text-center">
        <div className="font-bold text-[14px] tracking-wide uppercase">{data.venueName}</div>
        {data.address && <div className="text-[11px]">{data.address}</div>}
        {(data.city || data.phone) && <div className="text-[11px]">{[data.city, data.phone].filter(Boolean).join(" · ")}</div>}
        {data.matricule && <div className="text-[11px] mt-0.5">{t.caisse.receipt.mf} {data.matricule}</div>}
      </div>

      <Rule />

      {/* Meta */}
      <div className="flex flex-col gap-0.5 text-[11px]">
        <Row l={t.caisse.receipt.receiptNo} r={data.fiscalNumber || "—"} />
        <Row l={t.caisse.receipt.ticket} r={data.orderNumber} />
        <Row l={t.caisse.receipt.date} r={formatDate(data.dateISO)} />
        <Row l={data.orderTypeLabel} r={data.tableLabel} />
        <Row l={t.caisse.receipt.servedBy} r={data.staffName} />
      </div>

      <Rule />

      {/* Lines */}
      <div className="flex flex-col gap-1.5">
        {data.lines.map((line, i) => (
          <div key={i} className="flex flex-col">
            <div className="flex justify-between gap-2">
              <span className="truncate">
                <span className="tabular-nums">{line.qty}×</span> {line.name}
              </span>
              <span className="tabular-nums whitespace-nowrap" dir="ltr">{money(line.totalMillimes)}</span>
            </div>
            {line.mods.length > 0 && <span className="text-[10.5px] text-muted ps-4">{line.mods.join(", ")}</span>}
          </div>
        ))}
      </div>

      <Rule />

      {/* Totals */}
      <div className="flex flex-col gap-0.5 text-[11.5px]">
        <Row l={t.caisse.receipt.subtotal} r={money(data.subtotalMillimes)} />
        {data.taxMillimes > 0 && <Row l={interpolate(t.caisse.receipt.vat, { rate: data.tvaRate })} r={money(data.taxMillimes)} />}
        {data.timbreMillimes > 0 && <Row l={t.caisse.receipt.stamp} r={money(data.timbreMillimes)} />}
        {data.roundingMillimes !== 0 && <Row l={t.caisse.receipt.rounding} r={money(data.roundingMillimes)} />}
      </div>
      <div className="flex justify-between items-baseline font-bold text-[15px] mt-1 pt-1 border-t border-ink/20">
        <span>{t.caisse.receipt.total}</span>
        <span className="tabular-nums" dir="ltr">{money(data.totalMillimes)}</span>
      </div>

      <Rule />

      {/* Tender */}
      <div className="flex flex-col gap-0.5 text-[11.5px]">
        <Row l={t.caisse.receipt.payment} r={methodLabel[data.method] ?? data.method} />
        {data.method === "cash" && data.tenderedMillimes !== null && (
          <>
            <Row l={t.caisse.receipt.tendered} r={money(data.tenderedMillimes)} />
            <Row l={t.caisse.receipt.change} r={money(data.changeMillimes)} />
          </>
        )}
      </div>

      <Rule />
      <div className="text-center text-[11px] mt-1">{data.footer}</div>
    </div>
  );
}

function Row({ l, r }: { l: string; r: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{l}</span>
      <span className="tabular-nums text-end" dir="ltr">{r}</span>
    </div>
  );
}

function Rule() {
  return <div className="my-2 border-t border-dashed border-ink/25" aria-hidden />;
}

/**
 * Print target: hidden on screen, shown only when printing. The register shell is
 * marked print:hidden in the layout, so window.print() emits just this ticket.
 */
export function PrintReceipt() {
  const { lastSale } = useCaisse();
  if (!lastSale) return null;
  return (
    <div className="hidden print:block">
      <ReceiptView data={lastSale} />
    </div>
  );
}
