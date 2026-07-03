"use client";

import Link from "next/link";
import { LANGUAGES, LANGUAGE_LABELS, type Language } from "@chehia/shared";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { Logo, Wordmark, ZelligeMark } from "@/components/brand";
import { ContactForm } from "./contact-form";

/** chehia.app — public marketing landing. */
export function Landing() {
  return (
    <I18nProvider storageKey="chehia.lang">
      <LandingInner />
    </I18nProvider>
  );
}

const DEMO_HREF = "/r/cafe-el-marsa/t/demo-elmarsa-t12";

function LandingInner() {
  const { t, lang, setLang } = useI18n();

  const features = [
    { title: t.home.feature1Title, body: t.home.feature1Body, glyph: "❋", tint: "bg-harissa-tint", fg: "text-harissa-pressed" },
    { title: t.home.feature2Title, body: t.home.feature2Body, glyph: "◷", tint: "bg-teal-tint", fg: "text-teal-pressed" },
    { title: t.home.feature3Title, body: t.home.feature3Body, glyph: "ﻉ", tint: "bg-warning-tint", fg: "text-warning-text" },
    { title: t.home.feature4Title, body: t.home.feature4Body, glyph: "✦", tint: "bg-success-tint", fg: "text-success-text" },
  ];
  const steps = [t.home.how1, t.home.how2, t.home.how3];

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-[1040px] px-5 h-16 flex items-center justify-between gap-3">
          <Logo markSize={30} textSize={20} />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" dir="ltr">
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code as Language)}
                  className={`px-2 h-8 rounded-md text-[12px] font-bold transition-colors cursor-pointer ${
                    lang === code ? "bg-ink text-cream" : "text-muted hover:text-ink"
                  } ${code === "ar" ? "font-arabic text-[13px]" : ""}`}
                  aria-label={LANGUAGE_LABELS[code as Language]}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <Link
              href="/business"
              className="hidden sm:flex h-9 items-center px-4 rounded-lg border-[1.5px] border-line-strong text-ink font-bold text-[13px] hover:border-ink transition-colors"
            >
              {t.home.forBusinessesCta}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1040px] w-full px-5 pt-14 pb-16 sm:pt-20 flex flex-col items-center text-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-harissa" />
          <span className="text-[13px] font-bold text-muted tracking-wide">{t.common.tagline}</span>
        </div>
        <h1 className="font-display font-extrabold text-[38px] sm:text-[54px] leading-[1.05] text-ink max-w-[720px]">
          {t.home.heroTitle}
        </h1>
        <p className="text-[16px] sm:text-lg font-semibold text-muted max-w-[560px] leading-relaxed">
          {t.home.heroBody}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[440px] pt-2">
          <Link
            href="/app"
            className="flex-1 h-[54px] rounded-xl bg-harissa text-white font-extrabold text-[15.5px] flex items-center justify-center shadow-[0_8px_20px_rgba(188,75,38,0.28)] hover:bg-harissa-pressed transition-colors"
          >
            {t.home.findRestaurant}
          </Link>
          <Link
            href={DEMO_HREF}
            className="flex-1 h-[54px] rounded-xl border-2 border-ink text-ink font-extrabold text-[15.5px] flex items-center justify-center bg-card hover:bg-sand transition-colors"
          >
            {t.home.scanTable}
          </Link>
        </div>
        {/* Decorative zellige row */}
        <div className="flex items-center gap-2 pt-6 opacity-80" aria-hidden>
          {[24, 18, 30, 18, 24].map((s, i) => (
            <ZelligeMark key={i} size={s} radius={s * 0.28} color={i % 2 ? "#10606A" : "#BC4B26"} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-sand border-y border-line">
        <div className="mx-auto max-w-[1040px] w-full px-5 py-14 flex flex-col gap-8">
          <h2 className="font-display font-extrabold text-[26px] sm:text-[32px] text-ink text-center">
            {t.home.featuresTitle}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-2.5">
                <span className={`w-11 h-11 rounded-xl ${f.tint} ${f.fg} flex items-center justify-center text-xl font-extrabold`}>
                  {f.glyph}
                </span>
                <span className="font-extrabold text-[16px] text-ink">{f.title}</span>
                <span className="text-[13.5px] text-muted leading-relaxed">{f.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1040px] w-full px-5 py-16 flex flex-col gap-9">
        <h2 className="font-display font-extrabold text-[26px] sm:text-[32px] text-ink text-center">
          {t.home.howTitle}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-3">
              <span className="w-10 h-10 rounded-full bg-ink text-cream font-display font-extrabold text-lg flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-[15px] font-semibold text-ink leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="bg-sand border-y border-line">
        <div className="mx-auto max-w-[1040px] w-full px-5 py-14 flex flex-col gap-8">
          <div className="flex flex-col items-center text-center gap-2">
            <h2 className="font-display font-extrabold text-[26px] sm:text-[32px] text-ink">{t.home.plansTitle}</h2>
            <p className="text-[15px] font-semibold text-muted">{t.home.plansSubtitle}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 max-w-[720px] mx-auto w-full">
            <PlanCard
              name={t.home.starterName}
              tagline={t.home.starterFor}
              features={[t.home.feature1Title, t.home.feature2Title, t.home.feature3Title]}
              cta={t.home.plansCta}
            />
            <PlanCard
              name={t.home.proName}
              tagline={t.home.proFor}
              features={[t.home.proAllStarter, t.home.feature4Title, t.home.planStats]}
              cta={t.home.plansCta}
              badge={t.menu.popular}
              highlighted
            />
          </div>
        </div>
      </section>

      {/* For-business CTA */}
      <section className="mx-auto max-w-[1040px] w-full px-5 pb-16">
        <div className="rounded-3xl bg-ink px-6 sm:px-12 py-12 flex flex-col items-center text-center gap-5">
          <ZelligeMark size={48} color="#E08D6B" inner="#FAF6EF" radius={14} />
          <h2 className="font-display font-extrabold text-[26px] sm:text-[34px] text-cream max-w-[560px] leading-tight">
            {t.home.ctaTitle}
          </h2>
          <p className="text-[15px] font-semibold text-cream/70 max-w-[500px] leading-relaxed">{t.home.ctaBody}</p>
          <a
            href="#contact"
            className="h-[52px] px-8 rounded-xl bg-harissa text-white font-extrabold text-[15.5px] flex items-center justify-center shadow-[0_8px_20px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed transition-colors"
          >
            {t.home.ctaButton}
          </a>
        </div>
      </section>

      {/* Contact / lead capture */}
      <section id="contact" className="scroll-mt-20 bg-sand border-y border-line">
        <div className="mx-auto max-w-[640px] w-full px-5 py-14 flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-2">
            <h2 className="font-display font-extrabold text-[26px] sm:text-[32px] text-ink">{t.contact.title}</h2>
            <p className="text-[15px] font-semibold text-muted max-w-[460px]">{t.contact.subtitle}</p>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-cream">
        <div className="mx-auto max-w-[1040px] w-full px-5 py-10 flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row justify-between gap-8">
            <div className="flex flex-col gap-2 max-w-[280px]">
              <Wordmark size={20} />
              <span className="text-[12.5px] font-semibold text-muted-soft">{t.home.footerTagline}</span>
            </div>
            <div className="flex gap-12">
              <FooterCol
                title={t.home.product}
                links={[
                  [t.home.findRestaurant, "/app"],
                  [t.home.forBusinessesCta, "/business"],
                  [t.home.contact, "#contact"],
                ]}
              />
              <FooterCol
                title={t.home.legal}
                links={[
                  [t.home.privacy, "/legal/privacy"],
                  [t.home.terms, "/legal/terms"],
                ]}
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-6">
            <span className="text-[12px] text-muted-soft">
              {t.home.builtBy}{" "}
              <a
                href="https://aframat.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-muted hover:text-ink transition-colors"
              >
                AfraMAT
              </a>
              {" · © 2026 Chehia"}
            </span>
            <Link href="/admin" className="text-[11px] font-bold text-muted-soft hover:text-muted transition-colors">
              {t.home.admin}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({
  name,
  tagline,
  features,
  cta,
  badge,
  highlighted = false,
}: {
  name: string;
  tagline: string;
  features: string[];
  cta: string;
  badge?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative bg-card rounded-2xl p-6 flex flex-col gap-4 ${
        highlighted ? "border-2 border-harissa shadow-[0_8px_24px_rgba(188,75,38,0.12)]" : "border border-line"
      }`}
    >
      {badge && (
        <span className="absolute top-4 end-4 text-[10px] font-extrabold text-harissa-pressed bg-harissa-tint rounded-full px-2.5 py-1">
          {badge}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <span className="font-display font-extrabold text-xl text-ink">{name}</span>
        <span className="text-[13px] text-muted">{tagline}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[14px] text-ink">
            <span className="text-teal font-extrabold">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href="#contact"
        className={`mt-auto h-12 rounded-xl font-extrabold text-sm flex items-center justify-center transition-colors ${
          highlighted
            ? "bg-harissa text-white shadow-[0_6px_16px_rgba(188,75,38,0.3)] hover:bg-harissa-pressed"
            : "border-2 border-ink text-ink hover:bg-sand"
        }`}
      >
        {cta}
      </a>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-bold text-muted-soft tracking-wide uppercase">{title}</span>
      {links.map(([label, href]) =>
        href.startsWith("#") ? (
          <a key={href} href={href} className="text-[13px] font-bold text-muted hover:text-ink transition-colors">
            {label}
          </a>
        ) : (
          <Link key={href} href={href} className="text-[13px] font-bold text-muted hover:text-ink transition-colors">
            {label}
          </Link>
        ),
      )}
    </div>
  );
}
