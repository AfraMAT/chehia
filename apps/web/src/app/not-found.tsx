import Link from "next/link";
import { ZelligeMark } from "@/components/brand";

/** Branded 404 — trilingual since we can't know the visitor's language here. */
export default function NotFound() {
  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-5 p-8 text-center">
      <ZelligeMark size={72} radius={20} />
      <span className="font-display font-extrabold text-6xl text-ink leading-none">404</span>
      <div className="flex flex-col gap-1">
        <p className="font-extrabold text-lg text-ink">Page introuvable</p>
        <p dir="rtl" className="font-extrabold text-lg text-ink font-arabic">الصفحة غير موجودة</p>
        <p className="text-sm text-muted">Page not found</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Link
          href="/"
          className="h-12 px-7 rounded-xl bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors"
        >
          Accueil · الرئيسية · Home
        </Link>
        <Link
          href="/app"
          className="h-12 px-7 rounded-xl border-2 border-ink text-ink font-extrabold text-[15px] flex items-center justify-center bg-card hover:bg-sand transition-colors"
        >
          Restaurants
        </Link>
      </div>
    </div>
  );
}
