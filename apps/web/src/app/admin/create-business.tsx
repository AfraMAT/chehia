"use client";

import { useMemo, useState } from "react";
import { callFunction } from "@/lib/supabase";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface ProvisionResult {
  restaurant: { id: string; slug: string; name: string };
  owner: { email: string; display_name: string; password: string; user_id: string };
}

/** Modal: platform admin provisions a venue + its owner account. */
export function CreateBusiness({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro">("starter");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const canSubmit = useMemo(
    () => name.trim() && effectiveSlug && ownerName.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail),
    [name, effectiveSlug, ownerName, ownerEmail],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { ok, data } = await callFunction<ProvisionResult & { error?: { code?: string } }>(
      "admin-provision-business",
      {
        restaurant: { name: name.trim(), slug: effectiveSlug, city: city.trim(), plan },
        owner: { display_name: ownerName.trim(), email: ownerEmail.trim(), password: password || undefined },
      },
    );
    setSubmitting(false);
    if (!ok || !data?.owner) {
      const code = (data as { error?: { code?: string } })?.error?.code;
      setError(code === "slug_taken" ? t.admin.slugTaken : code === "email_taken" ? t.admin.emailTaken : t.admin.createFailed);
      return;
    }
    setResult(data as ProvisionResult);
    onCreated();
  };

  const copy = () => {
    if (!result) return;
    const text = `Chehia — ${result.restaurant.name}\nPortail: /business\nE-mail: ${result.owner.email}\nMot de passe: ${result.owner.password}`;
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const inputClass =
    "h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-[460px] bg-card border border-line rounded-2xl shadow-xl my-8 p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-display font-extrabold text-xl text-ink">✓ {t.admin.createdTitle}</span>
              <span className="text-[13px] text-muted leading-relaxed">{t.admin.createdBody}</span>
            </div>
            <div className="bg-sand rounded-lg p-4 flex flex-col gap-2 text-sm" dir="ltr">
              <Row label={t.admin.venueName} value={result.restaurant.name} />
              <Row label="slug" value={result.restaurant.slug} />
              <Row label={t.auth.email} value={result.owner.email} />
              <Row label={t.admin.password} value={result.owner.password} mono />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="flex-1 h-11 rounded-lg border-[1.5px] border-line-strong text-ink font-extrabold text-sm cursor-pointer hover:bg-sand transition-colors"
              >
                {copied ? `✓ ${t.admin.copied}` : t.admin.copyCreds}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-lg bg-ink text-cream font-extrabold text-sm cursor-pointer"
              >
                {t.admin.done}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <span className="font-display font-extrabold text-xl text-ink">{t.admin.newVenue}</span>

            <Field label={t.admin.venueName}>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label={t.admin.slug} hint={t.admin.slugHint}>
              <input
                className={inputClass}
                dir="ltr"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <Field label={t.admin.city}>
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label={t.admin.plan}>
              <div className="flex gap-2" dir="ltr">
                {(["starter", "pro"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`flex-1 h-10 rounded-md font-bold text-[13px] cursor-pointer transition-colors ${
                      plan === p ? "bg-ink text-cream font-extrabold" : "border-[1.5px] border-line-strong text-muted"
                    }`}
                  >
                    {p === "pro" ? t.admin.planPro : t.admin.planStarter}
                  </button>
                ))}
              </div>
            </Field>

            <div className="border-t border-line pt-3 flex flex-col gap-1">
              <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{t.admin.ownerSection}</span>
            </div>
            <Field label={t.admin.ownerName}>
              <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </Field>
            <Field label={t.admin.ownerEmail}>
              <input className={inputClass} dir="ltr" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            </Field>
            <Field label={t.admin.password} hint={t.admin.passwordHint}>
              <input className={inputClass} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>

            {error && <p className="text-[13px] font-bold text-danger-text">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-lg border-[1.5px] border-line-strong text-ink font-extrabold text-sm cursor-pointer hover:bg-sand transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="flex-1 h-12 rounded-lg bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Spinner /> : t.admin.create}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-soft">{hint}</span>}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-extrabold text-muted-soft uppercase">{label}</span>
      <span className={`text-[13px] font-bold text-ink ${mono ? "font-mono" : ""} text-right break-all`}>{value}</span>
    </div>
  );
}
