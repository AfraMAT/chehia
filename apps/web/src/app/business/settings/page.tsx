"use client";

import { useCallback, useEffect, useState } from "react";
import { LANGUAGE_LABELS, LANGUAGES, type Language, type StaffRole } from "@chehia/shared";
import { callFunction, getSupabase } from "@/lib/supabase";
import { Spinner, Toggle } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { usePortal } from "../portal-provider";

interface StaffRow {
  id: string;
  display_name: string;
  role: StaffRole;
  is_active: boolean;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];
type DayHours = { open: string; close: string; closed: boolean };

/** Settings — venue profile, opening hours, languages, team management. */
export default function SettingsPage() {
  const { restaurant, refreshRestaurant, canManage } = usePortal();
  const { t } = useI18n();
  const supabase = getSupabase();

  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address);
  const [city, setCity] = useState(restaurant.city);
  const [phone, setPhone] = useState(restaurant.phone);
  const [languages, setLanguages] = useState<Language[]>(restaurant.languages as Language[]);
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(restaurant.default_language as Language);
  const [hours, setHours] = useState<Record<Day, DayHours>>(() => parseHours(restaurant.opening_hours));
  const [requireQr, setRequireQr] = useState(restaurant.require_qr ?? false);
  const [reviewsEnabled, setReviewsEnabled] = useState(restaurant.reviews_enabled !== false);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStaff = useCallback(async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, display_name, role, is_active")
      .eq("restaurant_id", restaurant.id)
      .order("created_at")
      .overrideTypes<StaffRow[], { merge: false }>();
    setStaffRows(data ?? []);
  }, [restaurant.id, supabase]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const toggleLanguage = (code: Language) => {
    setLanguages((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        const next = prev.filter((l) => l !== code);
        if (defaultLanguage === code && next[0]) setDefaultLanguage(next[0]);
        return next;
      }
      return [...prev, code];
    });
  };

  const save = async () => {
    setSaving(true);
    const opening: Record<string, string> = {};
    for (const d of DAYS) if (!hours[d].closed) opening[d] = `${hours[d].open}-${hours[d].close}`;
    await supabase
      .from("restaurants")
      .update({ name, address, city, phone, languages, default_language: defaultLanguage, opening_hours: opening, require_qr: requireQr, reviews_enabled: reviewsEnabled })
      .eq("id", restaurant.id);
    await refreshRestaurant();
    // Don't force the operator's portal UI language to the venue default on save —
    // their chosen language (chehia.portal.lang) is independent of the customer default.
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

  const dayLabel: Record<Day, string> = {
    mon: t.hours.mon,
    tue: t.hours.tue,
    wed: t.hours.wed,
    thu: t.hours.thu,
    fri: t.hours.fri,
    sat: t.hours.sat,
    sun: t.hours.sun,
  };
  const setDay = (d: Day, patch: Partial<DayHours>) => setHours((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));

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
        {/* Venue profile + hours */}
        <div className="flex-1 w-full max-w-[560px] flex flex-col gap-4">
          <div className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-4">
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

            <div className="flex items-start justify-between gap-3 pt-3 mt-1 border-t border-line">
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-[13px] font-extrabold text-ink">{t.portal.settings.requireQr}</span>
                <span className="text-[11.5px] text-muted leading-relaxed">{t.portal.settings.requireQrHint}</span>
              </div>
              <Toggle checked={requireQr} onChange={setRequireQr} label={t.portal.settings.requireQr} disabled={!canManage} />
            </div>

            <div className="flex items-start justify-between gap-3 pt-3 mt-1 border-t border-line">
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-[13px] font-extrabold text-ink">{t.portal.settings.reviewsEnabled}</span>
                <span className="text-[11.5px] text-muted leading-relaxed">{t.portal.settings.reviewsEnabledHint}</span>
              </div>
              <Toggle checked={reviewsEnabled} onChange={setReviewsEnabled} label={t.portal.settings.reviewsEnabled} disabled={!canManage} />
            </div>
          </div>

          {/* Opening hours */}
          <div className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-3">
            <span className="font-extrabold text-[15px] text-ink">{t.portal.settings.hours}</span>
            {DAYS.map((d) => (
              <div key={d} className="flex items-center gap-3">
                <span className="w-24 text-[13px] font-bold text-ink">{dayLabel[d]}</span>
                {hours[d].closed ? (
                  <span className="flex-1 text-[13px] font-bold text-muted-soft">{t.hours.closed}</span>
                ) : (
                  <div className="flex-1 flex items-center gap-2" dir="ltr">
                    <input
                      type="time"
                      disabled={!canManage}
                      value={hours[d].open}
                      onChange={(e) => setDay(d, { open: e.target.value })}
                      className="h-10 rounded-md border-[1.5px] border-line-strong bg-white px-2 text-sm font-bold text-ink outline-none focus:border-harissa disabled:opacity-60"
                    />
                    <span className="text-muted-soft">—</span>
                    <input
                      type="time"
                      disabled={!canManage}
                      value={hours[d].close}
                      onChange={(e) => setDay(d, { close: e.target.value })}
                      className="h-10 rounded-md border-[1.5px] border-line-strong bg-white px-2 text-sm font-bold text-ink outline-none focus:border-harissa disabled:opacity-60"
                    />
                  </div>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setDay(d, { closed: !hours[d].closed })}
                    className={`h-9 px-3 rounded-md text-[12px] font-extrabold cursor-pointer transition-colors ${
                      hours[d].closed ? "bg-teal-tint text-teal-pressed" : "border-[1.5px] border-line-strong text-muted"
                    }`}
                  >
                    {hours[d].closed ? t.hours.openLabel : t.hours.closed}
                  </button>
                )}
              </div>
            ))}
          </div>

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
          {canManage && <AddStaff onAdded={loadStaff} />}
        </div>
      </div>
    </div>
  );
}

function AddStaff({ onAdded }: { onAdded: () => Promise<void> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "waiter" | "kitchen">("waiter");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const roleLabel: Record<string, string> = {
    manager: t.portal.staff.manager,
    waiter: t.portal.staff.waiter,
    kitchen: t.portal.staff.kitchen,
  };

  const add = async () => {
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    const { ok, data } = await callFunction<{ account?: { email: string; password: string }; error?: { code?: string } }>("create-staff", {
      display_name: name.trim(),
      email: email.trim(),
      role,
      password: password || undefined,
    });
    setBusy(false);
    if (!ok || !data?.account) {
      setError(data?.error?.code === "email_taken" ? t.portal.staff.emailTaken : t.admin.createFailed);
      return;
    }
    setCreated({ email: data.account.email, password: data.account.password });
    setName("");
    setEmail("");
    setPassword("");
    await onAdded();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-lg border-[1.5px] border-line-strong text-ink font-extrabold text-sm cursor-pointer hover:bg-sand transition-colors"
      >
        + {t.portal.staff.add}
      </button>
    );
  }

  const inp = "h-10 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa w-full";

  return (
    <div className="border border-line rounded-xl p-3.5 flex flex-col gap-3">
      <span className="font-extrabold text-[13px] text-ink">{t.portal.staff.addTitle}</span>
      {created && (
        <div className="bg-success-tint rounded-lg p-3 flex flex-col gap-1 text-[13px]" dir="ltr">
          <span className="font-extrabold text-success-text">✓ {t.portal.staff.created}</span>
          <span className="font-bold text-ink break-all">{created.email}</span>
          <span className="font-mono font-bold text-ink break-all">{created.password}</span>
          <span className="text-[11px] text-muted">{t.portal.staff.credentialsBody}</span>
        </div>
      )}
      <input className={inp} placeholder={t.portal.staff.displayName} value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inp} placeholder={t.portal.staff.email} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="flex gap-2" dir="ltr">
        {(["manager", "waiter", "kitchen"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 h-9 rounded-md text-[12.5px] font-bold cursor-pointer transition-colors ${
              role === r ? "bg-ink text-cream font-extrabold" : "border-[1.5px] border-line-strong text-muted"
            }`}
          >
            {roleLabel[r]}
          </button>
        ))}
      </div>
      <input className={inp} placeholder={t.portal.staff.password} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-[12px] font-bold text-danger-text">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 h-10 rounded-md border-[1.5px] border-line-strong text-muted font-extrabold text-[13px] cursor-pointer hover:bg-sand transition-colors"
        >
          {t.common.close}
        </button>
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy}
          className="flex-1 h-10 rounded-md bg-harissa text-white font-extrabold text-[13px] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? <Spinner /> : t.portal.staff.create}
        </button>
      </div>
    </div>
  );
}

function parseHours(src: Record<string, string> | null | undefined): Record<Day, DayHours> {
  const hours = {} as Record<Day, DayHours>;
  const has = src && Object.keys(src).length > 0;
  for (const d of DAYS) {
    const spec = src?.[d];
    if (spec) {
      const [open, close] = spec.split("-");
      hours[d] = { open: open ?? "08:00", close: close ?? "22:00", closed: false };
    } else {
      hours[d] = { open: "08:00", close: "22:00", closed: !!has };
    }
  }
  return hours;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{label}</span>
      {children}
    </div>
  );
}
