"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";

interface Lead {
  id: string;
  name: string;
  business_name: string;
  email: string;
  phone: string;
  city: string;
  message: string;
  locale: string;
  source: string;
  status: "new" | "contacted" | "closed";
  created_at: string;
}

/** Platform-admin view of incoming sales enquiries (leads) with status control. */
export function LeadsPanel() {
  const { t, lang } = useI18n();
  const supabase = getSupabase();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_leads");
    setLeads((data as Lead[] | null) ?? []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: Lead["status"]) => {
    setBusyId(id);
    await supabase.from("leads").update({ status }).eq("id", id);
    await load();
    setBusyId(null);
  };

  const chip: Record<Lead["status"], { cls: string; label: string }> = {
    new: { cls: "bg-harissa-tint text-harissa-pressed", label: t.admin.leadNew },
    contacted: { cls: "bg-teal-tint text-teal-pressed", label: t.admin.leadContacted },
    closed: { cls: "bg-sand-deep text-muted-soft", label: t.admin.leadClosed },
  };

  if (leads === null) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-7 h-7 border-[3px] border-harissa border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-card border border-line rounded-2xl p-10 flex flex-col items-center gap-2 text-center">
        <span className="font-extrabold text-lg text-ink">{t.admin.leadsEmpty}</span>
        <span className="text-sm text-muted">{t.admin.leadsEmptyBody}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {leads.map((l) => (
        <div key={l.id} className="bg-card border border-line rounded-xl p-4 flex flex-col gap-2.5">
          <div className="flex items-start gap-3">
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-[15px] text-ink">{l.business_name || l.name}</span>
                <span className={`text-[10px] font-extrabold rounded-full px-2 py-0.5 ${chip[l.status].cls}`}>
                  {chip[l.status].label}
                </span>
                <span className="text-[10px] font-bold text-muted-soft uppercase">{l.locale}</span>
              </div>
              <span className="text-[12.5px] font-semibold text-muted-soft">
                {l.business_name ? `${l.name} · ` : ""}
                {l.city || "—"}
                {" · "}
                {new Date(l.created_at).toLocaleDateString(lang === "ar" ? "ar-TN" : lang === "en" ? "en-GB" : "fr-FR")}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]" dir="ltr">
            <a href={`mailto:${l.email}`} className="font-bold text-teal-pressed hover:underline">
              {l.email}
            </a>
            {l.phone && (
              <a href={`tel:${l.phone}`} className="font-bold text-muted hover:text-ink">
                {l.phone}
              </a>
            )}
          </div>

          {l.message && <p className="text-[13.5px] text-muted leading-relaxed bg-sand rounded-lg px-3 py-2">{l.message}</p>}

          <div className="flex gap-2">
            {l.status !== "contacted" && l.status !== "closed" && (
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => void setStatus(l.id, "contacted")}
                className="h-8 px-3 rounded-lg text-[12.5px] font-extrabold bg-teal-tint text-teal-pressed cursor-pointer disabled:opacity-50"
              >
                {t.admin.markContacted}
              </button>
            )}
            {l.status !== "closed" && (
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => void setStatus(l.id, "closed")}
                className="h-8 px-3 rounded-lg text-[12.5px] font-extrabold border-[1.5px] border-line-strong text-muted hover:bg-sand cursor-pointer disabled:opacity-50"
              >
                {t.admin.markClosed}
              </button>
            )}
            {l.status !== "new" && (
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => void setStatus(l.id, "new")}
                className="h-8 px-3 rounded-lg text-[12.5px] font-extrabold border-[1.5px] border-line-strong text-muted hover:bg-sand cursor-pointer disabled:opacity-50"
              >
                {t.admin.reopen}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
