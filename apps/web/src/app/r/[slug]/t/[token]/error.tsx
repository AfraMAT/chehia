"use client";

import { ZelligeMark } from "@/components/brand";

/** Transient load failure — trilingual since the venue language is unknown here. */
export default function VenueError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[520px] min-h-dvh bg-cream flex flex-col items-center justify-center gap-5 p-8 text-center">
      <ZelligeMark size={64} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display font-extrabold text-2xl text-ink">Une erreur est survenue</h1>
        <p dir="rtl" className="font-bold text-lg text-ink">
          حدث خطأ
        </p>
        <p className="text-sm text-muted">Something went wrong</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="h-12 px-8 rounded-xl bg-harissa text-white font-extrabold text-[15px] shadow-[0_4px_12px_rgba(188,75,38,0.25)] cursor-pointer"
      >
        Réessayer · أعد المحاولة · Retry
      </button>
    </div>
  );
}
