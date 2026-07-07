"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/ui";
import { useSession } from "./session-provider";

const NICK_KEY = "chehia.nickname";

/** Start a new group order, or join an existing one by code. */
export function GroupSheet({
  initialCode,
  onClose,
  onJoined,
}: {
  initialCode?: string;
  onClose: () => void;
  onJoined: () => void;
}) {
  const { t } = useI18n();
  const { start, join } = useSession();
  const [mode, setMode] = useState<"start" | "join">(initialCode ? "join" : "start");
  const [nickname, setNickname] = useState<string>(() => {
    try {
      return localStorage.getItem(NICK_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errMsg = (e: string) =>
    e.includes("full") ? t.group.errorFull : e.includes("closed") ? t.group.errorClosed : e.includes("not_found") ? t.group.errorNotFound : t.errors.generic;

  const go = async () => {
    if (mode === "join" && !code.trim()) return;
    setBusy(true);
    setError(null);
    const nick = nickname.trim() || "Guest";
    try {
      localStorage.setItem(NICK_KEY, nick);
    } catch {
      // ignore
    }
    const err = mode === "start" ? await start(nick) : await join(code.trim(), nick);
    setBusy(false);
    if (err) {
      setError(errMsg(err));
      return;
    }
    onJoined();
  };

  const inputCls = "h-11 rounded-lg border-[1.5px] border-line-strong bg-white px-3.5 text-[14px] font-bold text-ink outline-none focus:border-teal transition-colors w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label={t.common.close} className="absolute inset-0 bg-ink/45 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-cream rounded-t-3xl flex flex-col p-5 gap-4 shadow-[0_-12px_40px_rgba(34,26,19,0.3)]">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[20px]">👥</span>
          <h2 className="font-display font-extrabold text-[20px] text-ink flex-1">{t.group.orderTogether}</h2>
          <button type="button" aria-label={t.common.close} onClick={onClose} className="text-muted-soft font-extrabold text-lg cursor-pointer">✕</button>
        </div>

        {/* Mode switch */}
        <div className="flex gap-1 bg-sand-deep rounded-lg p-1">
          {(["start", "join"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 h-9 rounded-md text-[13px] font-extrabold cursor-pointer transition-colors ${mode === m ? "bg-card text-ink shadow-sm" : "text-muted"}`}
            >
              {m === "start" ? t.group.startCta : t.group.join}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-extrabold text-muted-soft">{t.group.yourName}</span>
          <input className={inputCls} placeholder={t.group.namePlaceholder} value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
        </label>

        {mode === "join" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-extrabold text-muted-soft">{t.group.code}</span>
            <input className={`${inputCls} uppercase tracking-widest`} placeholder={t.group.enterCode} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} dir="ltr" />
          </label>
        )}

        {error && <p className="text-[13px] font-bold text-danger-text">{error}</p>}

        <button
          type="button"
          onClick={() => void go()}
          disabled={busy || (mode === "join" && !code.trim())}
          className="h-13 min-h-[52px] rounded-xl bg-teal text-white font-extrabold text-[15px] flex items-center justify-center gap-2 hover:bg-teal-pressed transition-colors cursor-pointer disabled:bg-disabled"
        >
          {busy ? <Spinner /> : mode === "start" ? t.group.start : t.group.joinCta}
        </button>
      </div>
    </div>
  );
}
