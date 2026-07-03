import Link from "next/link";
import { Logo } from "@/components/brand";

/** Readable, centered shell for the legal pages, with a way back to the landing. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[760px] w-full px-5 h-16 flex items-center">
          <Link href="/" aria-label="Chehia">
            <Logo markSize={28} textSize={19} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] w-full px-5 py-10 flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-[760px] w-full px-5 py-6 flex items-center justify-between text-[12.5px] text-muted-soft">
          <Link href="/" className="font-bold text-muted hover:text-ink transition-colors">
            ← Chehia
          </Link>
          <span>
            Conçu par{" "}
            <a href="https://aframat.com" target="_blank" rel="noopener noreferrer" className="font-bold text-muted hover:text-ink">
              AfraMAT
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
