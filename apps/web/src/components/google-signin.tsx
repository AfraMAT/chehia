"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/supabase";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

/**
 * "Continue with Google" button + an "or" divider, for the staff/admin sign-in
 * pages. On success this triggers a full-page redirect to Google, so nothing
 * after the call runs; only the failure path re-enables the button.
 */
export function GoogleSignIn({ ctx }: { ctx: "business" | "admin" }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await signInWithGoogle(ctx);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="h-12 rounded-lg border-[1.5px] border-line-strong bg-white text-ink font-bold text-[15px] flex items-center justify-center gap-2.5 hover:border-harissa hover:text-harissa-pressed transition-colors cursor-pointer disabled:opacity-60"
      >
        {busy ? (
          <Spinner />
        ) : (
          <>
            <GoogleG />
            {t.auth.continueWithGoogle}
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="text-[13px] font-bold text-danger-text text-center">
          {t.auth.googleFailed}
        </p>
      )}
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-bold text-muted-soft uppercase tracking-wide">{t.auth.orEmail}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

/** Google's four-color "G" mark. */
function GoogleG() {
  return (
    <svg viewBox="0 0 18 18" className="w-[18px] h-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
