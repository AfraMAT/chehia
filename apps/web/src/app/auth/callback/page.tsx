"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Logo } from "@/components/brand";
import { I18nProvider, useI18n } from "@/components/i18n-provider";

/**
 * OAuth landing page. Google (via Supabase) redirects here after sign-in with a
 * PKCE `code` in the URL, which the browser client auto-exchanges for a session
 * (detectSessionInUrl defaults on). We then resolve the caller's role and route:
 *   platform admin → /admin, active staff → /business/orders,
 *   neither → sign out + "no access" (Google authenticates, but access still
 *   requires a provisioned staff/admin row).
 */
export default function AuthCallbackPage() {
  return (
    <I18nProvider initial="fr" storageKey="chehia.portal.lang">
      <Callback />
    </I18nProvider>
  );
}

type State = "working" | "denied" | "error";

function Callback() {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<State>("working");
  const [ctx, setCtx] = useState<"business" | "admin">("business");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCtx(params.get("ctx") === "admin" ? "admin" : "business");

    // Google can bounce back with an explicit error (user cancelled, etc.).
    if (params.get("error")) {
      setState("error");
      return;
    }

    const supabase = getSupabase();
    let done = false;

    const resolve = async (): Promise<boolean> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user || user.is_anonymous) return false; // session not established yet

      const { data: adminRow } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("auth_uid", user.id)
        .maybeSingle();
      if (adminRow) {
        router.replace("/admin");
        return true;
      }

      const { data: staffRow } = await supabase
        .from("staff")
        .select("id")
        .eq("auth_uid", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (staffRow) {
        router.replace("/business/orders");
        return true;
      }

      // Authenticated, but not linked to any Chehia workspace → deny.
      await supabase.auth.signOut();
      setState("denied");
      return true;
    };

    const finish = async () => {
      if (done) return;
      if (await resolve()) done = true;
    };

    // The URL exchange fires an auth event once the session lands; also try
    // immediately in case it is already present.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void finish();
    });
    void finish();

    // If nothing resolves in time, don't spin forever.
    const timer = setTimeout(() => {
      if (!done) setState("error");
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  if (state === "working") {
    return (
      <Shell>
        <span className="w-8 h-8 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted">{t.auth.completingSignIn}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <span className="font-display font-extrabold text-xl text-ink">
        {state === "denied" ? t.auth.noAccessTitle : t.errors.generic}
      </span>
      <p className="text-sm text-muted leading-relaxed max-w-[320px]">
        {state === "denied" ? t.auth.noAccessBody : t.auth.googleFailed}
      </p>
      <button
        type="button"
        onClick={() => router.replace(ctx === "admin" ? "/admin/login" : "/business/login")}
        className="h-11 px-6 rounded-lg bg-ink text-cream font-extrabold text-sm cursor-pointer"
      >
        {t.auth.backToSignIn}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
      <div className="bg-card border border-line rounded-2xl p-8 max-w-[380px] w-full flex flex-col items-center gap-4 text-center">
        <Logo markSize={40} textSize={24} />
        {children}
      </div>
    </div>
  );
}
