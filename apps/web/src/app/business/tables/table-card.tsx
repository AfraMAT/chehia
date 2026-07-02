"use client";

import { ZelligeMark, Wordmark } from "@/components/brand";
import { QrImage } from "./qr-image";

/** The printable A6 table card — the white-glove onboarding artifact. */
export function TableCard({
  url,
  tableLabel,
  venueName,
  venueAddress,
  qrSize = 150,
}: {
  url: string;
  tableLabel: string;
  venueName: string;
  venueAddress: string;
  qrSize?: number;
}) {
  return (
    <div className="w-[270px] bg-cream border border-line rounded-[20px] px-5 py-6 flex flex-col items-center gap-3.5 shadow-[0_14px_34px_rgba(60,35,15,0.14)]">
      <div className="flex items-center gap-2">
        <ZelligeMark size={24} radius={7} />
        <Wordmark size={16} />
      </div>
      <div className="bg-white border border-line rounded-xl p-2">
        <QrImage url={url} size={qrSize} />
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="font-display font-extrabold text-[19px] text-ink leading-tight">Scannez pour commander</span>
        <span dir="rtl" className="font-arabic font-semibold text-[15px] text-muted">
          امسح واطلب من طاولتك
        </span>
        <span className="text-[11px] font-bold text-muted-soft tracking-wider">SCAN TO ORDER</span>
      </div>
      <div className="self-stretch border-t border-dashed border-line-strong pt-3 flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-extrabold text-muted-soft tracking-widest">TABLE</span>
          <span className="font-display font-extrabold text-[30px] leading-none text-harissa">{tableLabel}</span>
        </div>
        <span className="text-[11px] font-bold text-muted text-end leading-snug">
          {venueName}
          <br />
          {venueAddress}
        </span>
      </div>
    </div>
  );
}
