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
  const [state, setState] = useState<"loading" | "ready" | "unauthenticated" | "no-staff">("loading");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user || user.is_anonymous) {
      setState("unauthenticated");
      return;
    }
    const { data: staffRow } = await supabase
      .from("staff")
      .select("id, restaurant_id, role, display_name")
      .eq("auth_uid", user.id)
      .eq("is_active", true)
      .maybeSingle<StaffProfile>();
    if (!staffRow) {
      setState("no-staff");
      return;
    }
    const { data: resto } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", staffRow.restaurant_id)
      .maybeSingle<Restaurant>();
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

  useEffect(() => {
    if (state === "unauthenticated" || state === "no-staff") {
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
