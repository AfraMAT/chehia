import type { Metadata } from "next";
import { CaisseProvider } from "./caisse-provider";
import { PrintReceipt } from "./_register/receipt";

export const metadata: Metadata = {
  title: "Chehia Caisse",
  description: "Point de vente pour cafés et restaurants — Chehia.",
  manifest: "/caisse.webmanifest",
};

/**
 * Full-screen POS shell — no portal sidebar, its own provider. On print the
 * register is hidden and only the receipt (PrintReceipt) is emitted, sized for
 * an 80mm thermal roll.
 */
export default function CaisseLayout({ children }: { children: React.ReactNode }) {
  return (
    <CaisseProvider>
      <style
        dangerouslySetInnerHTML={{
          __html: "@media print { @page { size: 72mm auto; margin: 3mm; } body { background: #fff; } }",
        }}
      />
      <div className="print:hidden">{children}</div>
      <PrintReceipt />
    </CaisseProvider>
  );
}
