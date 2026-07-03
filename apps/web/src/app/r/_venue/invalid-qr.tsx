import Link from "next/link";
import { ZelligeMark } from "@/components/brand";

/**
 * Shown when a slug/token doesn't resolve. Trilingual since we can't know the
 * venue's language. `kind="venue"` (discovery) offers a way back to the list;
 * `kind="qr"` (default, scanned) tells the guest to check the table card.
 */
export function InvalidQr({ kind = "qr" }: { kind?: "qr" | "venue" }) {
  const venue = kind === "venue";
  return (
    <div className="mx-auto w-full max-w-[520px] min-h-dvh bg-cream flex flex-col items-center justify-center gap-5 p-8 text-center">
      <ZelligeMark size={64} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display font-extrabold text-2xl text-ink">
          {venue ? "Établissement introuvable" : "Ce code QR n’est pas valide"}
        </h1>
        <p dir="rtl" className="font-bold text-lg text-ink">
          {venue ? "المطعم غير موجود" : "رمز QR غير صالح"}
        </p>
        <p className="text-sm text-muted">{venue ? "Restaurant not found" : "This QR code is not valid"}</p>
      </div>
      {venue ? (
        <Link href="/app" className="h-12 px-8 rounded-xl bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center shadow-[0_4px_12px_rgba(188,75,38,0.25)]">
          Voir tous les restaurants
        </Link>
      ) : (
        <p className="text-[13px] text-muted leading-relaxed max-w-[300px]">
          Demandez au personnel de vérifier la carte de table, ou consultez le menu au comptoir.
        </p>
      )}
    </div>
  );
}
