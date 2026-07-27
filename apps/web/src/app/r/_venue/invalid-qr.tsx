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
      {!venue && (
        <div className="flex flex-col gap-1.5 text-[13px] text-muted leading-relaxed max-w-[320px]">
          <p>Demandez au personnel de vérifier la carte de table, ou consultez le menu au comptoir.</p>
          <p dir="rtl">اطلب من الموظفين التحقق من بطاقة الطاولة، أو اطّلع على القائمة عند المنضدة.</p>
          <p>Ask the staff to check the table card, or see the menu at the counter.</p>
        </div>
      )}
      {/* Always give one clear way forward — a scanned dead-QR must never trap a
          guest with no next step. Discovery lets them find this venue (or a
          nearby one) and order through the browse flow. */}
      <Link
        href="/app"
        className="min-h-12 px-8 py-2.5 rounded-xl bg-harissa text-white flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_12px_rgba(188,75,38,0.25)]"
      >
        <span className="font-extrabold text-[15px]">{venue ? "Voir tous les restaurants" : "Découvrir les restaurants"}</span>
        <span dir="rtl" className="font-bold text-[13px]">
          {venue ? "عرض كل المطاعم" : "اكتشف المطاعم"}
        </span>
        <span className="text-[12px] text-white/85">{venue ? "See all restaurants" : "Discover restaurants"}</span>
      </Link>
    </div>
  );
}
