"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LANGUAGES, LANGUAGE_LABELS, type Language } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { Logo } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { useAdmin } from "./admin-provider";
import { CreateBusiness } from "./create-business";
import { LeadsPanel } from "./leads-panel";
import { PortalFooter } from "../business/portal-footer";

interface VenueOverview {
  id: string;
  slug: string;
  name: string;
  city: string;
  plan: string;
  is_active: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  order_count: number;
  table_count: number;
  staff_count: number;
}

type VenueStatus = "active" | "onboarding" | "inactive";

function statusOf(v: VenueOverview): VenueStatus {
  if (!v.onboarding_completed_at) return "onboarding";
  return v.is_active ? "active" : "inactive";
}

export default function AdminDashboard() {
  const { t, lang, setLang } = useI18n();
  const { admin, signOut } = useAdmin();
  const supabase = getSupabase();
  const [venues, setVenues] = useState<VenueOverview[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"venues" | "leads">("venues");

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_venue_overview");
    setVenues((data as VenueOverview[] | null) ?? []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (v: VenueOverview) => {
    setBusyId(v.id);
    await supabase.from("restaurants").update({ is_active: !v.is_active }).eq("id", v.id);
    await load();
    setBusyId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return venues ?? [];
    return (venues ?? []).filter((v) => v.name.toLowerCase().includes(q) || v.slug.includes(q) || v.city.toLowerCase().includes(q));
  }, [venues, query]);

  const statusStyle: Record<VenueStatus, string> = {
    active: "text-success-text bg-success-tint",
    onboarding: "text-harissa-pressed bg-harissa-tint",
    inactive: "text-muted-soft bg-sand-deep",
  };
  const statusLabel: Record<VenueStatus, string> = {
    active: t.admin.statusActive,
    onboarding: t.admin.statusOnboarding,
    inactive: t.admin.statusInactive,
  };

  return (
    <div className="min-h-dvh bg-sand">
      <header className="bg-card border-b border-line sticky top-0 z-10">
        <div className="max-w-[960px] mx-auto px-6 h-16 flex items-center gap-4">
          <Logo markSize={30} textSize={19} />
          <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase border-s border-line ps-4">
            {t.admin.title}
          </span>
          <div className="flex-1" />
          <div className="flex gap-1" dir="ltr">
            {LANGUAGES.map((code: Language) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`h-8 px-2.5 rounded-md text-[12px] font-bold cursor-pointer transition-colors ${
                  lang === code ? "bg-ink text-cream" : "text-muted hover:bg-sand"
                }`}
              >
                {LANGUAGE_LABELS[code].slice(0, 2)}
              </button>
            ))}
          </div>
          <span className="hidden md:inline text-[12px] font-bold text-muted-soft">{admin.display_name}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-[12px] font-bold text-muted hover:text-danger-text cursor-pointer"
          >
            {t.auth.signOut}
          </button>
        </div>
      </header>

      <main className="max-w-[960px] mx-auto px-6 py-6 flex flex-col gap-4">
        <div className="flex gap-1 bg-sand-deep rounded-lg p-1 self-start">
          {(["venues", "leads"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`h-8 px-4 rounded-md text-[13px] font-extrabold cursor-pointer transition-colors ${
                tab === k ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {k === "venues" ? t.admin.venuesTab : t.admin.leadsTab}
            </button>
          ))}
        </div>

        {tab === "leads" ? (
          <LeadsPanel />
        ) : (
          <>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display font-extrabold text-2xl text-ink">{t.admin.venues}</h1>
          <span className="text-sm font-bold text-muted-soft">{venues?.length ?? 0}</span>
          <div className="flex-1" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.admin.search}
            className="h-10 w-[200px] rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors"
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-10 px-4 rounded-lg bg-harissa text-white font-extrabold text-sm shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer"
          >
            {t.admin.addVenue}
          </button>
        </div>

        {venues === null ? (
          <div className="flex justify-center py-16">
            <span className="w-7 h-7 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-line rounded-2xl p-10 flex flex-col items-center gap-2 text-center">
            <span className="font-extrabold text-lg text-ink">{t.admin.empty}</span>
            <span className="text-sm text-muted">{t.admin.emptyBody}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((v) => {
              const status = statusOf(v);
              return (
                <div key={v.id} className="bg-card border border-line rounded-xl p-4 flex items-center gap-4">
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[15px] text-ink truncate">{v.name}</span>
                      <span className={`text-[10px] font-extrabold rounded-full px-2 py-0.5 ${statusStyle[status]}`}>
                        {statusLabel[status]}
                      </span>
                      <span className="text-[10px] font-extrabold rounded-full px-2 py-0.5 bg-sand-deep text-muted-soft uppercase">
                        {v.plan === "pro" ? t.admin.planPro : t.admin.planStarter}
                      </span>
                    </div>
                    <span className="text-[12px] font-semibold text-muted-soft truncate" dir="ltr">
                      /r/{v.slug}
                      {v.city ? ` · ${v.city}` : ""}
                    </span>
                  </div>
                  <div className="hidden sm:flex flex-col items-end text-[11px] font-bold text-muted-soft leading-tight">
                    <span>
                      {v.order_count} {t.admin.ordersLabel}
                    </span>
                    <span>
                      {v.table_count} {t.admin.tablesLabel}
                    </span>
                  </div>
                  {status !== "onboarding" && (
                    <button
                      type="button"
                      disabled={busyId === v.id}
                      onClick={() => void toggleActive(v)}
                      className={`h-9 px-3.5 rounded-lg text-[13px] font-extrabold cursor-pointer transition-colors disabled:opacity-50 ${
                        v.is_active
                          ? "border-[1.5px] border-line-strong text-muted hover:bg-sand"
                          : "bg-teal-tint text-teal-pressed border-2 border-teal"
                      }`}
                    >
                      {v.is_active ? t.admin.deactivate : t.admin.activate}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </main>

      <PortalFooter className="max-w-[960px] mx-auto w-full" />

      {creating && <CreateBusiness onClose={() => setCreating(false)} onCreated={() => void load()} />}
    </div>
  );
}
