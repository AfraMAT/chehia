"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Language, Restaurant, StaffRole } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { I18nProvider } from "@/components/i18n-provider";

export interface StaffProfile {
  id: string;
  restaurant_id: string;
  role: StaffRole;
  display_name: string;
}

interface PortalContextValue {
  staff: StaffProfile;
  restaurant: Restaurant;
  refreshRestaurant: () => Promise<void>;
  signOut: () => Promise<void>;
  canManage: boolean;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unauthenticated" | "no-staff" | "error">("loading");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user || user.is_anonymous) {
      setState("unauthenticated");
      return;
    }
    const { data: staffRow, error: staffError } = await supabase
      .from("staff")
      .select("id, restaurant_id, role, display_name")
      .eq("auth_uid", user.id)
      .eq("is_active", true)
      .maybeSingle<StaffProfile>();
    if (staffError) {
      // Transient failure ≠ "not staff": offer a retry, don't bounce to login.
      setState("error");
      return;
    }
    if (!staffRow) {
      setState("no-staff");
      return;
    }
    const { data: resto, error: restoError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", staffRow.restaurant_id)
      .maybeSingle<Restaurant>();
    if (restoError) {
      setState("error");
      return;
    }
    if (!resto) {
      setState("no-staff");
      return;
    }
    setStaff(staffRow);
    setRestaurant(resto);
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // React to session expiry/revocation instead of leaving a zombie portal.
  useEffect(() => {
    const { data: sub } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/business/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (state === "unauthenticated") {
      router.replace("/business/login");
    }
  }, [state, router]);

  const refreshRestaurant = useCallback(async () => {
    if (!staff) return;
    const { data } = await getSupabase().from("restaurants").select("*").eq("id", staff.restaurant_id).maybeSingle<Restaurant>();
    if (data) setRestaurant(data);
  }, [staff]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    router.replace("/business/login");
  }, [router]);

  const value = useMemo<PortalContextValue | null>(
    () =>
      staff && restaurant
        ? {
            staff,
            restaurant,
            refreshRestaurant,
            signOut,
            canManage: staff.role === "owner" || staff.role === "manager",
          }
        : null,
    [staff, restaurant, refreshRestaurant, signOut],
  );

  if (state === "no-staff") {
    // Signed in but not staff anywhere (or deactivated): a redirect to login
    // would just loop, so explain and offer sign-out.
    return (
      <div className="min-h-dvh bg-sand flex items-center justify-center p-6" data-pathname={pathname}>
        <div className="bg-card border border-line rounded-2xl p-8 max-w-[380px] flex flex-col items-center gap-4 text-center">
          <span className="font-display font-extrabold text-xl text-ink">Accès non autorisé</span>
          <p className="text-sm text-muted leading-relaxed">
            Ce compte n&apos;est rattaché à aucun restaurant actif. Contactez le propriétaire de votre établissement.
          </p>
          <button
            type="button"
            onClick={() => {
              void getSupabase()
                .auth.signOut()
                .then(() => router.replace("/business/login"));
            }}
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
      <div className="min-h-dvh bg-sand flex items-center justify-center p-6" data-pathname={pathname}>
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
      <div className="min-h-dvh bg-sand flex items-center justify-center" data-pathname={pathname}>
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <I18nProvider initial={(restaurant?.default_language ?? "fr") as Language} storageKey="chehia.portal.lang">
      <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
    </I18nProvider>
  );
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
}
