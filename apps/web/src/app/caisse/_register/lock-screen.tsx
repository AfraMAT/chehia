"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse } from "../caisse-provider";

/**
 * Full-screen lock. Shown when the register is locked. If the cashier has no PIN
 * yet, they create one (enter + confirm) and the register stays locked so they —
 * or whoever returns — unlock with it. Otherwise it's a plain unlock pad.
 */
export function LockScreen() {
  const { t } = useI18n();
  const { restaurant, staff, hasPin, unlock, setPin } = useCaisse();
  const [entry, setEntry] = useState("");
  const [firstEntry, setFirstEntry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const creating = !hasPin;
  const confirming = creating && firstEntry !== null;
  const title = creating
    ? confirming
      ? t.caisse.lock.confirmCode
      : t.caisse.lock.createCode
    : t.caisse.lock.locked;

  const press = (d: string) => {
    setError(null);
    setEntry((p) => (p.length >= 6 ? p : p + d));
  };
  const back = () => setEntry((p) => p.slice(0, -1));

  const submit = async () => {
    if (entry.length < 4) {
      setError(t.caisse.lock.minDigits);
      return;
    }
    setBusy(true);
    if (creating) {
      if (!confirming) {
        setFirstEntry(entry);
        setEntry("");
        setBusy(false);
        return;
      }
      if (firstEntry !== entry) {
        setError(t.caisse.lock.mismatch);
        setFirstEntry(null);
        setEntry("");
        setBusy(false);
        return;
      }
      const ok = await setPin(entry);
      setBusy(false);
      setEntry("");
      setFirstEntry(null);
      if (!ok) setError(t.caisse.lock.error);
      // On success hasPin flips true → this screen re-renders into unlock mode.
    } else {
      const ok = await unlock(entry);
      setBusy(false);
      if (!ok) {
        setError(t.caisse.lock.wrong);
        setEntry("");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink flex flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[12px] font-extrabold tracking-widest uppercase text-cream/50">{restaurant.name}</span>
        <span className="font-display font-extrabold text-2xl text-cream">{title}</span>
        <span className="text-[13px] font-semibold text-cream/60">{staff.display_name}</span>
      </div>

      {/* Dots */}
      <div className="flex gap-3" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-colors ${i < entry.length ? "bg-harissa" : "bg-cream/15"}`}
          />
        ))}
      </div>

      {error && <span className="text-[13.5px] font-bold text-harissa-soft">{error}</span>}

      {/* Pad */}
      <div className="grid grid-cols-3 gap-3 w-[264px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PadKey key={d} onClick={() => press(d)}>{d}</PadKey>
        ))}
        <PadKey onClick={back} muted><span className="text-xl">⌫</span></PadKey>
        <PadKey onClick={() => press("0")}>0</PadKey>
        <PadKey onClick={submit} accent disabled={busy || entry.length < 4}>
          <span className="text-[15px]">OK</span>
        </PadKey>
      </div>
    </div>
  );
}

function PadKey({
  children, onClick, accent, muted, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-16 rounded-2xl font-extrabold text-2xl flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40 ${
        accent
          ? "bg-harissa text-white hover:bg-harissa-pressed"
          : muted
            ? "bg-cream/5 text-cream/70 hover:bg-cream/10"
            : "bg-cream/10 text-cream hover:bg-cream/20"
      }`}
    >
      {children}
    </button>
  );
}
