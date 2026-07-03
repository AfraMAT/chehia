"use client";

import { memo, useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders a real QR code as an <img> data URL, harissa-on-white for scan contrast.
 * Memoized: the dataURL is stable once computed for a given url/size, so unrelated
 * parent updates (e.g. selecting a table preview) don't re-render every card's QR.
 */
export const QrImage = memo(function QrImage({ url, size = 150, className = "" }: { url: string; size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#221A13", light: "#FFFFFF" },
    })
      .then((data) => {
        if (!cancelled) setDataUrl(data);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return <div className={`bg-white border border-line rounded-lg ${className}`} style={{ width: size, height: size }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR code" width={size} height={size} className={`rounded-lg ${className}`} />;
});
