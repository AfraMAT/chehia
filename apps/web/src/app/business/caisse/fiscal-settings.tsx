"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Spinner, Toggle } from "@/components/ui";
import { usePortal } from "../portal-provider";

/**
 * Fiscal configuration for the register. Owner/manager sets the régime, tax
 * identity, TVA/timbre and receipt footer; the caisse reads these to fill the
 * ticket de caisse. Defaults to the simplest legal case (forfaitaire). FR-first.
 */

const ROUNDING_OPTIONS = [
  { value: 0, label: "Aucun" },
  { value: 10, label: "10 millimes" },
  { value: 50, label: "50 millimes" },
  { value: 100, label: "100 millimes" },
];

interface FiscalForm {
  regime: "forfait" | "reel";
  matricule_fiscal: string;
  legal_name: string;
  legal_form: string;
  tva_registered: boolean;
  default_tva_rate: string;
  timbre_tnd: string;
  cash_rounding_millimes: number;
  receipt_footer: string;
}

const EMPTY: FiscalForm = {
  regime: "forfait",
  matricule_fiscal: "",
  legal_name: "",
  legal_form: "",
  tva_registered: false,
  default_tva_rate: "19",
  timbre_tnd: "0",
  cash_rounding_millimes: 100,
  receipt_footer: "",
};

export function FiscalSettings() {
  const { restaurant } = usePortal();
  const supabase = getSupabase();
  const [form, setForm] = useState<FiscalForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("restaurant_fiscal")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setForm({
            regime: data.regime === "reel" ? "reel" : "forfait",
            matricule_fiscal: data.matricule_fiscal ?? "",
            legal_name: data.legal_name ?? "",
            legal_form: data.legal_form ?? "",
            tva_registered: !!data.tva_registered,
            default_tva_rate: String(data.default_tva_rate ?? "19"),
            timbre_tnd: ((data.timbre_millimes ?? 0) / 1000).toString(),
            cash_rounding_millimes: data.cash_rounding_millimes ?? 100,
            receipt_footer: data.receipt_footer ?? "",
          });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurant.id, supabase]);

  const update = <K extends keyof FiscalForm>(key: K, val: FiscalForm[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const rate = Number.parseFloat(form.default_tva_rate.replace(",", ".")) || 0;
    const timbre = Math.round((Number.parseFloat(form.timbre_tnd.replace(",", ".")) || 0) * 1000);
    const { error } = await supabase.from("restaurant_fiscal").upsert({
      restaurant_id: restaurant.id,
      regime: form.regime,
      matricule_fiscal: form.matricule_fiscal.trim(),
      legal_name: form.legal_name.trim(),
      legal_form: form.legal_form.trim(),
      tva_registered: form.regime === "reel" && form.tva_registered,
      default_tva_rate: Math.min(100, Math.max(0, rate)),
      timbre_millimes: Math.max(0, timbre),
      cash_rounding_millimes: form.cash_rounding_millimes,
      receipt_footer: form.receipt_footer.trim(),
    });
    setSaving(false);
    if (!error) setSaved(true);
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Spinner className="text-harissa w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Régime fiscal">
        <div className="flex rounded-xl bg-sand p-1 gap-1 w-fit">
          {(["forfait", "reel"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update("regime", r)}
              className={`h-10 px-5 rounded-lg text-[14px] font-extrabold cursor-pointer transition-colors ${
                form.regime === r ? "bg-card text-harissa-pressed shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {r === "forfait" ? "Forfaitaire" : "Réel"}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted-soft mt-2 leading-relaxed">
          {form.regime === "forfait"
            ? "Régime forfaitaire : pas de TVA ni de timbre sur le ticket (cas le plus courant pour un petit café)."
            : "Régime réel : la TVA et le timbre sont calculés et affichés sur le ticket. À confirmer avec votre comptable."}
        </p>
      </Card>

      <Card title="Identité fiscale">
        <Field label="Matricule fiscal" value={form.matricule_fiscal} onChange={(v) => update("matricule_fiscal", v)} placeholder="1234567A/P/M/000" />
        <Field label="Raison sociale" value={form.legal_name} onChange={(v) => update("legal_name", v)} placeholder={restaurant.name} />
        <Field label="Forme juridique (optionnel)" value={form.legal_form} onChange={(v) => update("legal_form", v)} placeholder="SARL, personne physique…" />
      </Card>

      <Card title="TVA & timbre">
        {form.regime === "reel" ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-ink">Assujetti à la TVA</span>
              <Toggle checked={form.tva_registered} onChange={(v) => update("tva_registered", v)} />
            </div>
            {form.tva_registered && (
              <Field label="Taux de TVA (%)" value={form.default_tva_rate} onChange={(v) => update("default_tva_rate", v)} placeholder="19" inputMode="decimal" />
            )}
            <Field label="Timbre fiscal (TND)" value={form.timbre_tnd} onChange={(v) => update("timbre_tnd", v)} placeholder="1,000" inputMode="decimal" />
          </>
        ) : (
          <p className="text-[13px] text-muted-soft">TVA et timbre désactivés en régime forfaitaire.</p>
        )}
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-[13px] font-bold text-ink">Arrondi des espèces</label>
          <select
            value={form.cash_rounding_millimes}
            onChange={(e) => update("cash_rounding_millimes", Number(e.target.value))}
            className="h-11 rounded-lg border-[1.5px] border-line-strong bg-white px-3 text-[14px] text-ink outline-none focus:border-harissa w-fit"
          >
            {ROUNDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-[12px] text-muted-soft">Les paiements en espèces sont arrondis au plus proche.</span>
        </div>
      </Card>

      <Card title="Pied de ticket">
        <textarea
          value={form.receipt_footer}
          onChange={(e) => update("receipt_footer", e.target.value)}
          placeholder="Merci de votre visite !"
          rows={2}
          maxLength={200}
          className="rounded-lg border-[1.5px] border-line-strong bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted-soft outline-none focus:border-harissa resize-none"
        />
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-12 px-8 rounded-xl bg-harissa text-white font-extrabold text-[15px] cursor-pointer hover:bg-harissa-pressed transition-colors disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[14px] font-bold text-teal-pressed">Enregistré ✓</span>}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-3">
      <h2 className="font-extrabold text-[15px] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label, value, onChange, placeholder, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-bold text-ink">{label}</label>
      <input
        value={value}
        inputMode={inputMode ?? "text"}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-lg border-[1.5px] border-line-strong bg-white px-3.5 text-[14px] text-ink placeholder:text-muted-soft outline-none focus:border-harissa"
      />
    </div>
  );
}
