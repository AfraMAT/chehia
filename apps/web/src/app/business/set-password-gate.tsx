"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/ui";

/**
 * The password form itself — reused by the first-login gate and the Settings
 * "Security" card. Sets a new password and clears the `must_change_password`
 * flag in one atomic updateUser call.
 */
export function SetPasswordForm({ onDone, ctaLabel }: { onDone?: () => void; ctaLabel?: string }) {
  const { t } = useI18n();
  const s = t.auth.setPassword;
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) {
      setError(s.weak);
      return;
    }
    if (pw !== confirm) {
      setError(s.mismatch);
      return;
    }
    setBusy(true);
    const { error: updErr } = await getSupabase().auth.updateUser({
      password: pw,
      data: { must_change_password: false },
    });
    setBusy(false);
    if (updErr) {
      const code = (updErr as { code?: string }).code ?? "";
      const msg = (updErr.message ?? "").toLowerCase();
      if (code === "same_password" || msg.includes("different from the old")) setError(s.samePassword);
      else if (msg.includes("password") && (msg.includes("least") || msg.includes("weak") || msg.includes("6 char") || msg.includes("short")))
        setError(s.weak);
      else setError(s.error);
      return;
    }
    setPw("");
    setConfirm("");
    onDone?.();
  };

  const inputClass =
    "h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5" dir="ltr">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{s.new}</span>
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={inputClass}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{s.confirm}</span>
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={inputClass}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <button type="button" onClick={() => setShow((v) => !v)} className="self-start text-[12px] font-bold text-muted hover:text-ink cursor-pointer">
        {show ? s.hide : s.show}
      </button>
      {error && <p className="text-[12.5px] font-bold text-danger-text">{error}</p>}
      <button
        type="submit"
        disabled={busy || !pw || !confirm}
        className="h-11 rounded-lg bg-harissa text-white font-extrabold text-sm cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {busy ? <Spinner className="w-4 h-4" /> : (ctaLabel ?? s.save)}
      </button>
    </form>
  );
}

/** Full-screen first-login gate: the owner/staff must set a personal password. */
export function SetPasswordGate({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const s = t.auth.setPassword;
  const signOut = async () => {
    await getSupabase().auth.signOut();
    router.replace("/business/login");
  };
  return (
    <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
      <div className="bg-card border border-line rounded-2xl shadow-[0_2px_10px_rgba(60,35,15,0.05)] p-8 max-w-[400px] w-full flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div aria-hidden className="w-12 h-12 rounded-full bg-harissa-tint text-harissa-pressed flex items-center justify-center text-2xl">
            🔒
          </div>
          <span className="font-display font-extrabold text-xl text-ink">{s.title}</span>
          <p className="text-sm text-muted leading-relaxed">{s.subtitle}</p>
        </div>
        <SetPasswordForm onDone={onDone} />
        {/* Escape hatch: if the password update keeps failing, don't trap them. */}
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-[12px] font-bold text-muted hover:text-danger-text cursor-pointer self-center"
        >
          {t.auth.signOut}
        </button>
      </div>
    </div>
  );
}
