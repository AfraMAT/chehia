"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { Logo } from "@/components/brand";
import { Spinner } from "@/components/ui";
import { SetPasswordForm } from "../set-password-gate";

/**
 * Password-recovery landing. Supabase's reset email links here with a recovery
 * session already established; the customer sets a new password (SetPasswordForm
 * → updateUser) and is sent to the portal. If arrived without a recovery
 * session (stale/Forged link), we show a gentle "link expired" state.
 */
export default function ResetPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");

  useEffect(() => {
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      setReady(data.session ? "ok" : "no-session");
    });
  }, []);

  return (
    <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-card border border-line rounded-2xl shadow-[0_2px_10px_rgba(60,35,15,0.05)] p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4">
          <Logo markSize={44} textSize={26} />
          <h1 className="font-display font-extrabold text-xl text-ink text-center">{t.auth.resetTitle}</h1>
        </div>

        {ready === "checking" && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {ready === "no-session" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[13px] text-muted">{t.auth.resetExpired}</p>
            <button
              type="button"
              onClick={() => router.replace("/business/login")}
              className="h-11 px-5 rounded-lg bg-harissa text-white font-extrabold text-[14px] cursor-pointer hover:bg-harissa-pressed transition-colors"
            >
              {t.auth.signIn}
            </button>
          </div>
        )}
        {ready === "ok" && <SetPasswordForm onDone={() => router.replace("/business/orders")} ctaLabel={t.auth.resetCta} />}
      </div>
    </div>
  );
}
