import { ZelligeMark } from "@/components/brand";

/** Shown when the slug/token don't resolve — trilingual since we can't know the venue's language. */
export function InvalidQr() {
  return (
    <div className="mx-auto w-full max-w-[520px] min-h-dvh bg-cream flex flex-col items-center justify-center gap-5 p-8 text-center">
      <ZelligeMark size={64} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display font-extrabold text-2xl text-ink">Ce code QR n&apos;est pas valide</h1>
        <p dir="rtl" className="font-bold text-lg text-ink">
          رمز QR غير صالح
        </p>
        <p className="text-sm text-muted">This QR code is not valid</p>
      </div>
      <p className="text-[13px] text-muted leading-relaxed max-w-[300px]">
        Demandez au personnel de vérifier la carte de table, ou consultez le menu au comptoir.
      </p>
    </div>
  );
}
