"use client";

import { useState } from "react";
import { callFunction } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";

export const CONTACT_EMAIL = "contact@aframat.com";

const inputCls =
  "h-11 rounded-lg border-[1.5px] border-line-strong bg-white px-3.5 text-[14px] text-ink placeholder:text-muted-soft outline-none focus:border-harissa transition-colors";

/** Lead-capture form for restaurateurs — posts to the submit-lead edge function. */
export function ContactForm() {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [form, setForm] = useState({
    name: "",
    business_name: "",
    email: "",
    phone: "",
    city: "",
    message: "",
    company_website: "", // honeypot — real users leave this empty
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    if (form.name.trim().length < 2 || !form.email.includes("@")) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const { ok } = await callFunction("submit-lead", { ...form, locale: lang });
      setStatus(ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="bg-card border border-line rounded-2xl p-8 flex flex-col items-center text-center gap-2">
        <span className="w-14 h-14 rounded-full bg-success-tint text-success text-2xl flex items-center justify-center">✓</span>
        <h3 className="font-display font-extrabold text-xl text-ink mt-1">{t.contact.sentTitle}</h3>
        <p className="text-sm text-muted max-w-[320px]">{t.contact.sentBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-card border border-line rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
      {/* Honeypot — visually hidden, off-screen, not tabbable */}
      <input
        type="text"
        name="company_website"
        value={form.company_website}
        onChange={set("company_website")}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute w-px h-px -left-[9999px] opacity-0"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={inputCls} placeholder={t.contact.name} value={form.name} onChange={set("name")} required aria-label={t.contact.name} />
        <input className={inputCls} placeholder={t.contact.business} value={form.business_name} onChange={set("business_name")} aria-label={t.contact.business} />
        <input className={inputCls} type="email" placeholder={t.contact.email} value={form.email} onChange={set("email")} required aria-label={t.contact.email} />
        <input className={inputCls} type="tel" placeholder={t.contact.phone} value={form.phone} onChange={set("phone")} aria-label={t.contact.phone} />
      </div>
      <input className={inputCls} placeholder={t.contact.city} value={form.city} onChange={set("city")} aria-label={t.contact.city} />
      <textarea
        className="rounded-lg border-[1.5px] border-line-strong bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted-soft outline-none focus:border-harissa transition-colors resize-none"
        placeholder={t.contact.message}
        value={form.message}
        onChange={set("message")}
        rows={3}
        maxLength={2000}
        aria-label={t.contact.message}
      />
      {status === "error" && <p className="text-[13px] font-bold text-danger-text">{t.contact.error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="h-[52px] rounded-xl bg-harissa text-white font-extrabold text-[15.5px] flex items-center justify-center shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:bg-disabled disabled:shadow-none"
      >
        {status === "sending" ? t.contact.sending : t.contact.send}
      </button>
      <p className="text-center text-[12.5px] text-muted-soft">
        {t.contact.orEmail}{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-teal-pressed hover:underline">
          {CONTACT_EMAIL}
        </a>
      </p>
    </form>
  );
}
