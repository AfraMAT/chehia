"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_LABELS, LANGUAGES, type Language, type StaffRole } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { usePortal } from "../portal-provider";

interface StaffRow {
  id: string;
  display_name: string;
  role: StaffRole;
  is_active: boolean;
}

/** Settings — venue profile, languages, team overview. */
export default function SettingsPage() {
  const { restaurant, refreshRestaurant, canManage } = usePortal();
  const { t, setLang } = useI18n();
  const supabase = getSupabase();

  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address);
  const [city, setCity] = useState(restaurant.city);
  const [phone, setPhone] = useState(restaurant.phone);
  const [languages, setLanguages] = useState<Language[]>(restaurant.languages as Language[]);
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(restaurant.default_language as Language);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("staff")
        .select("id, display_name, role, is_active")
        .eq("restaurant_id", restaurant.id)
        .overrideTypes<StaffRow[], { merge: false }>();
      setStaffRows(data ?? []);
    })();
  }, [restaurant.id, supabase]);

  const toggleLanguage = (code: Language) => {
    setLanguages((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // keep at least one
        const next = prev.filter((l) => l !== code);
        if (defaultLanguage === code && next[0]) setDefaultLanguage(next[0]);
        return next;
      }
      return [...prev, code];
    });
  };

  const save = async () => {
    setSaving(true);
    await supabase
      .from("restaurants")
      .update({ name, address, city, phone, languages, default_language: defaultLanguage })
      .eq("id", restaurant.id);
    await refreshRestaurant();
    setLang(defaultLanguage);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const roleLabel = (role: StaffRole) =>
    ({
      owner: t.portal.staff.owner,
      manager: t.portal.staff.manager,
      waiter: t.portal.staff.waiter,
      kitchen: t.portal.staff.kitchen,
    })[role];

  const inputClass =
    "h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors w-full disabled:opacity-60";

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="flex items-center gap-3 px-6 pt-5 pb-3.5">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.portal.settings.title}</h1>
        {saved && (
          <span className="text-xs font-extrabold text-success-text bg-success-tint rounded-full px-3 py-1.5">
            ✓ {t.portal.settings.saved}
          </span>
        )}
      </div>

      <div className="px-6 pb-6 flex flex-col xl:flex-row gap-4 items-start">
        {/* Venue profile */}
        <div className="flex-1 w-full max-w-[560px] bg-card border border-line rounded-2xl p-5 flex flex-col gap-4">
          <span className="font-extrabold text-[15px] text-ink">{t.portal.settings.venueProfile}</span>

          <Field label={t.portal.settings.venueName}>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          </Field>
          <div className="flex gap-3">
            <Field label={t.portal.settings.address} className="flex-[2]">
              <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canManage} />
            </Field>
            <Field label={t.portal.settings.city} className="flex-1">
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} disabled={!canManage} />
            </Field>
          </div>
          <Field label={t.portal.settings.phone}>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canManage} dir="ltr" />
          </Field>

          <Field label={t.portal.settings.languages}>
            <div className="flex gap-2" dir="ltr">
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={!canManage}
                  onClick={() => toggleLanguage(code)}
                  className={`flex-1 h-11 rounded-md font-bold text-sm cursor-pointer transition-colors disabled:cursor-default ${
                    languages.includes(code)
                      ? "bg-teal-tint border-2 border-teal text-teal-pressed font-extrabold"
                      : "border-[1.5px] border-line-strong text-muted"
                  }`}
                >
                  {LANGUAGE_LABELS[code]}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t.portal.settings.defaultLanguage}>
            <div className="flex gap-2" dir="ltr">
              {languages.map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setDefaultLanguage(code)}
                  className={`flex-1 h-10 rounded-md font-bold text-[13px] cursor-pointer transition-colors disabled:cursor-default ${
                    defaultLanguage === code ? "bg-ink text-cream font-extrabold" : "border-[1.5px] border-line-strong text-muted"
                  }`}
                >
                  {LANGUAGE_LABELS[code]}
                </button>
              ))}
            </div>
          </Field>

          {canManage && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="h-12 rounded-lg bg-harissa text-white font-extrabold text-[15px] shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:opacity-60"
            >
              {t.common.save}
            </button>
          )}
        </div>

        {/* Team */}
        <div className="w-full xl:w-[380px] bg-card border border-line rounded-2xl p-5 flex flex-col gap-3">
          <span className="font-extrabold text-[15px] text-ink">{t.portal.staff.title}</span>
          <div className="flex flex-col gap-2">
            {staffRows.map((row) => (
              <div key={row.id} className="flex items-center gap-3 bg-sand rounded-md px-3.5 py-3">
                <div className="w-9 h-9 rounded-full bg-teal-tint text-teal-pressed font-extrabold text-sm flex items-center justify-center shrink-0">
                  {row.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-extrabold text-[13.5px] text-ink truncate">{row.display_name}</span>
                  <span className="text-[11.5px] font-bold text-muted-soft">{roleLabel(row.role)}</span>
                </div>
                <span
                  className={`text-[10.5px] font-extrabold rounded-full px-2 py-0.5 ${
                    row.is_active ? "text-success-text bg-success-tint" : "text-muted-soft bg-sand-deep"
                  }`}
                >
                  {row.is_active ? t.portal.staff.active : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{label}</span>
      {children}
    </div>
  );
}
