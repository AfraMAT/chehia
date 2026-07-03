"use client";

import { useEffect, useState } from "react";
import type { WaiterCallReason } from "@chehia/shared";
import { callFunction, ensureCustomerSession } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/ui";
import { useVenue } from "./venue-provider";

/** P6 · Call waiter — bottom sheet with reason presets; lands on staff devices with the table number. */
export function WaiterSheet({ onClose }: { onClose: () => void }) {
  const { table } = useVenue();
  const { t } = useI18n();
  const [reason, setReason] = useState<WaiterCallReason>("bill");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const options: { value: WaiterCallReason; label: string }[] = [
    { value: "bill", label: t.waiter.bill },
    { value: "water", label: t.waiter.water },
    { value: "cutlery", label: t.waiter.cutlery },
    { value: "other", label: t.waiter.other },
  ];

  const send = async () => {
    if (state === "sending") return;
    setState("sending");
    try {
      if (!table) throw new Error("no table");
      await ensureCustomerSession();
      const target = table.qr_token ? { qr_token: table.qr_token } : { table_id: table.id };
      const { ok } = await callFunction("call-waiter", { ...target, reason, note });
      if (!ok) throw new Error("failed");
      setState("sent");
      setTimeout(onClose, 1600);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label={t.common.close} className="absolute inset-0 bg-ink/45 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-card rounded-t-3xl px-5 pt-3 pb-5 shadow-[0_-12px_40px_rgba(34,26,19,0.3)]">
        <div aria-hidden className="w-11 h-[5px] rounded bg-line-strong mx-auto mb-4" />

        {state === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-full bg-success-tint flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-success text-white flex items-center justify-center font-extrabold text-lg">
                ✓
              </div>
            </div>
            <span className="font-display font-extrabold text-xl text-ink">{t.waiter.sent}</span>
            <span className="text-sm text-muted">{t.waiter.sentBody}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 mb-4">
              <h2 className="font-display font-extrabold text-[23px] text-ink">{t.waiter.callTitle}</h2>
              <p className="text-[13px] font-semibold text-muted leading-relaxed">{t.waiter.callBody}</p>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {options.map((opt) => {
                const active = reason === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setReason(opt.value);
                      // A note typed under "other" must not ride along with a preset.
                      if (opt.value !== "other") setNote("");
                    }}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-start cursor-pointer transition-colors ${
                      active ? "border-2 border-harissa bg-harissa-tint" : "border-[1.5px] border-line-strong bg-white"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`w-5 h-5 rounded-full shrink-0 ${
                        active ? "border-[6px] border-harissa bg-white" : "border-2 border-disabled"
                      }`}
                    />
                    <span className={`font-bold text-[14.5px] ${active ? "text-harissa-pressed font-extrabold" : "text-ink"}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
              {reason === "other" && (
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="…"
                  className="rounded-lg border-[1.5px] border-line-strong bg-white px-4 py-3 text-[14px] text-ink outline-none focus:border-harissa"
                />
              )}
            </div>
            {state === "error" && <p className="text-[13px] font-bold text-danger-text mb-2">{t.errors.generic}</p>}
            <button
              type="button"
              onClick={send}
              disabled={state === "sending"}
              className="w-full h-[54px] rounded-xl bg-ink text-cream font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {state === "sending" ? <Spinner /> : t.waiter.send}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
