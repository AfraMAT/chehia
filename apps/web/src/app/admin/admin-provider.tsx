"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { I18nProvider } from "@/components/i18n-provider";

export interface AdminProfile {
  id: string;
  display_name: string;
}

interface AdminContextValue {
  admin: AdminProfile;
  signOut: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

/**
 * Guards the /admin area: the caller must have a row in platform_admins.
 * Mirrors PortalProvider's state machine (loading / unauthenticated /
 * not-admin / error / ready) so a transient failure never bounces to login.
 */
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unauthenticated" | "not-admin" | "error">("loading");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user || user.is_anonymous) {
      setState("unauthenticated");
      return;
    }
    const { data: row, error } = await supabase
      .from("platform_admins")
      .select("id, display_name")
      .eq("auth_uid", user.id)
      .maybeSingle<AdminProfile>();
    if (error) {
      setState("error");
      return;
    }
    if (!row) {
      setState("not-admin");
      return;
    }
    setAdmin(row);
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const { data: sub } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/admin/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (state === "unauthenticated") router.replace("/admin/login");
  }, [state, router]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    router.replace("/admin/login");
  }, [router]);

  const value = useMemo<AdminContextValue | null>(
    () => (admin ? { admin, signOut } : null),
    [admin, signOut],
  );

  if (state === "not-admin") {
    return (
      <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
        <div className="bg-card border border-line rounded-2xl p-8 max-w-[380px] flex flex-col items-center gap-4 text-center">
          <span className="font-display font-extrabold text-xl text-ink">Accès non autorisé</span>
          <p className="text-sm text-muted leading-relaxed">
            Ce compte n&apos;a pas accès à l&apos;administration Chehia.
          </p>
          <button
            type="button"
            onClick={() => void getSupabase().auth.signOut().then(() => router.replace("/admin/login"))}
            className="h-11 px-6 rounded-lg bg-ink text-cream font-extrabold text-sm cursor-pointer"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
        <div className="bg-card border border-line rounded-2xl p-8 max-w-[380px] flex flex-col items-center gap-4 text-center">
          <span className="font-display font-extrabold text-xl text-ink">Une erreur est survenue</span>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              void load();
            }}
            className="h-11 px-6 rounded-lg bg-harissa text-white font-extrabold text-sm cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (state !== "ready" || !value) {
    return (
      <div className="min-h-dvh bg-sand flex items-center justify-center">
        <span className="w-8 h-8 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <I18nProvider initial="fr" storageKey="chehia.admin.lang">
      <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
    </I18nProvider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
