import Link from "next/link";
import { Logo, ZelligeMark } from "@/components/brand";

/** Root landing — points to the demo venue and the business portal. */
export default function Home() {
  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-10 p-8">
      <div className="flex flex-col items-center gap-5 text-center">
        <ZelligeMark size={76} radius={20} />
        <div className="flex flex-col items-center gap-2">
          <span className="font-display font-extrabold text-5xl text-ink tracking-tight">
            chehia<span className="text-harissa">.</span>
          </span>
          <p className="text-lg font-semibold text-muted">Scannez. Commandez. Régalez-vous.</p>
          <p dir="rtl" className="font-arabic font-semibold text-lg text-teal">
            امسح. اطلب. استمتع.
          </p>
        </div>
        <p className="max-w-[420px] text-sm text-muted leading-relaxed">
          Commande à table par QR code pour les cafés et restaurants tunisiens — application native, portail
          restaurateur en temps réel et recommandations intelligentes.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[420px]">
        <Link
          href="/r/cafe-el-marsa/t/demo-elmarsa-t12"
          className="flex-1 h-14 rounded-xl bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors"
        >
          Démo client — Table 12
        </Link>
        <Link
          href="/business/orders"
          className="flex-1 h-14 rounded-xl border-2 border-ink text-ink font-extrabold text-[15px] flex items-center justify-center bg-card hover:bg-sand transition-colors"
        >
          Portail restaurateur
        </Link>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-soft">
        <Logo markSize={18} textSize={13} />
        <span>· Café El Marsa est un lieu de démonstration</span>
      </div>

      <Link href="/admin" className="text-[11px] font-bold text-muted-soft hover:text-muted transition-colors">
        Administration
      </Link>
    </div>
  );
}
