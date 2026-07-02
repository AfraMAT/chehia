"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Logo } from "@/components/brand";
import { Spinner } from "@/components/ui";
import { I18nProvider, useI18n } from "@/components/i18n-provider";

export default function AdminLoginPage() {
  return (
    <I18nProvider initial="fr" storageKey="chehia.admin.lang">
      <AdminLoginForm />
    </I18nProvider>
  );
}

function AdminLoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const supabase = getSupabase();
    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.user) {
      setError(t.auth.invalidCredentials);
      setSubmitting(false);
      return;
    }
    // Confirm platform-admin membership before entering; otherwise sign back
    // out so a non-admin can't hold a lingering session on /admin.
    const { data: row } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("auth_uid", signIn.user.id)
      .maybeSingle();
    if (!row) {
      await supabase.auth.signOut();
      setError(t.admin.notAdmin);
      setSubmitting(false);
      return;
    }
    router.replace("/admin");
  };

  return (
    <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-card border border-line rounded-2xl shadow-[0_2px_10px_rgba(60,35,15,0.05)] p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4">
          <Logo markSize={44} textSize={26} />
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="font-display font-extrabold text-xl text-ink">{t.admin.signInTitle}</h1>
            <p className="text-[13px] text-muted">{t.admin.signInSubtitle}</p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">
              {t.auth.email}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm text-ink outline-none focus:border-harissa transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">
              {t.auth.password}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm text-ink outline-none focus:border-harissa transition-colors"
            />
          </div>
          {error && <p className="text-[13px] font-bold text-danger-text">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-12 rounded-lg bg-ink text-cream font-extrabold text-[15px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
          >
            {submitting ? <Spinner /> : t.auth.signIn}
          </button>
        </form>
      </div>
    </div>
  );
}
