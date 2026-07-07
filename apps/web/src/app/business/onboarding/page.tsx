"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, LANGUAGE_LABELS, type Category, type Language } from "@chehia/shared";
import { callFunction, getSupabase } from "@/lib/supabase";
import { Logo } from "@/components/brand";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { usePortal } from "../portal-provider";
import { MenuImport } from "../menu/menu-import";
import { AppearanceStudio } from "../appearance/appearance-studio";
import { StockStep } from "./stock-step";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

/** "5,5" / "5.5" TND → integer millimes. Returns null on unparseable input. */
function toMillimes(input: string): number | null {
  const n = Number.parseFloat(input.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000);
}

const inputClass =
  "h-11 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-sm font-bold text-ink outline-none focus:border-harissa transition-colors w-full";

export default function OnboardingPage() {
  const { t, lang, setLang } = useI18n();
  const { restaurant, refreshRestaurant, signOut } = usePortal();
  const router = useRouter();
  const supabase = getSupabase();
  const defaultLang = restaurant.default_language as Language;

  const STEPS = useMemo(
    () => [
      t.onboarding.stepProfile,
      t.onboarding.stepHours,
      t.onboarding.stepMenu,
      t.onboarding.stepAppearance,
      t.onboarding.stepStock,
      t.onboarding.stepTables,
      t.onboarding.stepStaff,
    ],
    [t],
  );
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const [menuValid, setMenuValid] = useState(false);

  // The wizard is setup-only: an already-onboarded venue must not re-enter it
  // (its steps show stale data and the Stock step could edit live inventory).
  // `done` guards the just-finished screen from bouncing before its CTA.
  useEffect(() => {
    if (restaurant.onboarding_completed_at && !done) router.replace("/business/orders");
  }, [restaurant.onboarding_completed_at, done, router]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = useCallback(async () => {
    setFinishing(true);
    await supabase
      .from("restaurants")
      .update({ onboarding_completed_at: new Date().toISOString(), is_active: true })
      .eq("id", restaurant.id);
    await refreshRestaurant();
    setDone(true);
    setFinishing(false);
  }, [supabase, restaurant.id, refreshRestaurant]);

  if (done) {
    return (
      <div className="min-h-dvh bg-sand flex items-center justify-center p-6">
        <div className="bg-card border border-line rounded-2xl p-8 max-w-[420px] flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-success-tint text-success-text flex items-center justify-center text-2xl font-extrabold">✓</div>
          <span className="font-display font-extrabold text-2xl text-ink">{t.onboarding.completeTitle}</span>
          <p className="text-sm text-muted leading-relaxed">{t.onboarding.completeBody}</p>
          <button
            type="button"
            onClick={() => router.replace("/business/orders")}
            className="h-12 px-8 rounded-lg bg-harissa text-white font-extrabold text-[15px] shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer"
          >
            {t.onboarding.goToPortal}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-sand flex flex-col">
      <header className="bg-card border-b border-line">
        <div className="max-w-[640px] mx-auto px-5 h-16 flex items-center gap-4">
          <Logo markSize={28} textSize={18} />
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
          <button type="button" onClick={() => void signOut()} className="text-[12px] font-bold text-muted hover:text-danger-text cursor-pointer">
            {t.auth.signOut}
          </button>
        </div>
      </header>

      <div className="max-w-[640px] w-full mx-auto px-5 py-6 flex flex-col gap-5 flex-1">
        {/* Progress */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold text-harissa-pressed uppercase tracking-wide">
              {t.onboarding.step} {step + 1} {t.onboarding.of} {STEPS.length} · {STEPS[step]}
            </span>
          </div>
          <div className="flex gap-1.5" dir="ltr">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-harissa" : "bg-line-strong"}`} />
            ))}
          </div>
        </div>

        <div className="bg-card border border-line rounded-2xl p-5 flex flex-col gap-4 flex-1">
          {step === 0 && <ProfileStep />}
          {step === 1 && <HoursStep />}
          {step === 2 && <MenuStep defaultLang={defaultLang} onValidChange={setMenuValid} />}
          {step === 3 && <AppearanceStep />}
          {step === 4 && <StockStep />}
          {step === 5 && <TablesStep />}
          {step === 6 && <StaffStep />}
        </div>

        {/* Nav */}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="h-12 px-5 rounded-lg border-[1.5px] border-line-strong text-ink font-extrabold text-sm cursor-pointer hover:bg-sand transition-colors"
            >
              {t.onboarding.back}
            </button>
          )}
          <div className="flex-1" />
          {step === STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={finishing}
              className="h-12 px-4 rounded-lg text-muted font-bold text-sm cursor-pointer hover:bg-sand transition-colors disabled:opacity-50"
            >
              {t.onboarding.skip}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <NextButton step={step} menuValid={menuValid} onNext={next} />
          ) : (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={finishing}
              className="h-12 px-6 rounded-lg bg-harissa text-white font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:opacity-60"
            >
              {finishing ? <Spinner /> : t.onboarding.finish}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// The wizard is split into small step components that persist their own slice
// immediately, so partial progress survives a reload and "Next" is pure navigation.

function ProfileStep() {
  const { t } = useI18n();
  const { restaurant, refreshRestaurant } = usePortal();
  const supabase = getSupabase();
  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address);
  const [city, setCity] = useState(restaurant.city);
  const [phone, setPhone] = useState(restaurant.phone);
  const [languages, setLanguages] = useState<Language[]>(restaurant.languages as Language[]);
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(restaurant.default_language as Language);

  // Persist on unmount/change via a debounce-free save when the field blurs.
  const save = useCallback(async () => {
    await supabase
      .from("restaurants")
      .update({ name, address, city, phone, languages, default_language: defaultLanguage })
      .eq("id", restaurant.id);
    await refreshRestaurant();
  }, [supabase, name, address, city, phone, languages, defaultLanguage, restaurant.id, refreshRestaurant]);

  // Persist the latest profile when the step unmounts (Next / Back).
  useEffect(() => {
    return () => {
      void save();
    };
  }, [save]);

  const toggleLanguage = (code: Language) => {
    setLanguages((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        const nextLangs = prev.filter((l) => l !== code);
        if (defaultLanguage === code && nextLangs[0]) setDefaultLanguage(nextLangs[0]);
        return nextLangs;
      }
      return [...prev, code];
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <StepHeading title={t.onboarding.stepProfile} body={t.onboarding.stepProfileBody} />
      <FieldLabel label={t.portal.settings.venueName}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </FieldLabel>
      <div className="flex gap-3">
        <FieldLabel label={t.portal.settings.address} className="flex-[2]">
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </FieldLabel>
        <FieldLabel label={t.portal.settings.city} className="flex-1">
          <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
        </FieldLabel>
      </div>
      <FieldLabel label={t.portal.settings.phone}>
        <input className={inputClass} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </FieldLabel>
      <FieldLabel label={t.portal.settings.languages}>
        <div className="flex gap-2" dir="ltr">
          {LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggleLanguage(code)}
              className={`flex-1 h-11 rounded-md font-bold text-sm cursor-pointer transition-colors ${
                languages.includes(code) ? "bg-teal-tint border-2 border-teal text-teal-pressed font-extrabold" : "border-[1.5px] border-line-strong text-muted"
              }`}
            >
              {LANGUAGE_LABELS[code]}
            </button>
          ))}
        </div>
      </FieldLabel>
      <FieldLabel label={t.portal.settings.defaultLanguage}>
        <div className="flex gap-2" dir="ltr">
          {languages.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setDefaultLanguage(code)}
              className={`flex-1 h-10 rounded-md font-bold text-[13px] cursor-pointer transition-colors ${
                defaultLanguage === code ? "bg-ink text-cream font-extrabold" : "border-[1.5px] border-line-strong text-muted"
              }`}
            >
              {LANGUAGE_LABELS[code]}
            </button>
          ))}
        </div>
      </FieldLabel>
    </div>
  );
}

function HoursStep() {
  const { t } = useI18n();
  const { restaurant, refreshRestaurant } = usePortal();
  const supabase = getSupabase();

  const parse = (spec: string | undefined): { open: string; close: string; closed: boolean } => {
    if (!spec) return { open: "08:00", close: "22:00", closed: true };
    const [open, close] = spec.split("-");
    return { open: open ?? "08:00", close: close ?? "22:00", closed: false };
  };
  const [hours, setHours] = useState<Record<Day, { open: string; close: string; closed: boolean }>>(() => {
    const src = restaurant.opening_hours ?? {};
    const initial = {} as Record<Day, { open: string; close: string; closed: boolean }>;
    for (const d of DAYS) initial[d] = src[d] ? parse(src[d]) : { open: "08:00", close: "22:00", closed: !src[d] && Object.keys(src).length > 0 };
    // If no hours at all yet, default every day open 08:00–22:00.
    if (Object.keys(src).length === 0) for (const d of DAYS) initial[d] = { open: "08:00", close: "22:00", closed: false };
    return initial;
  });

  const save = useCallback(async () => {
    const opening: Record<string, string> = {};
    for (const d of DAYS) if (!hours[d].closed) opening[d] = `${hours[d].open}-${hours[d].close}`;
    await supabase.from("restaurants").update({ opening_hours: opening }).eq("id", restaurant.id);
    await refreshRestaurant();
  }, [supabase, hours, restaurant.id, refreshRestaurant]);

  // Persist hours when the step unmounts.
  useEffect(() => {
    return () => {
      void save();
    };
  }, [save]);

  const setDay = (d: Day, patch: Partial<{ open: string; close: string; closed: boolean }>) =>
    setHours((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));

  const dayLabel: Record<Day, string> = {
    mon: t.hours.mon,
    tue: t.hours.tue,
    wed: t.hours.wed,
    thu: t.hours.thu,
    fri: t.hours.fri,
    sat: t.hours.sat,
    sun: t.hours.sun,
  };

  return (
    <div className="flex flex-col gap-4">
      <StepHeading title={t.onboarding.stepHours} body={t.onboarding.stepHoursBody} />
      <div className="flex flex-col gap-2">
        {DAYS.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-24 text-[13px] font-bold text-ink">{dayLabel[d]}</span>
            {hours[d].closed ? (
              <span className="flex-1 text-[13px] font-bold text-muted-soft">{t.hours.closed}</span>
            ) : (
              <div className="flex-1 flex items-center gap-2" dir="ltr">
                <input
                  type="time"
                  value={hours[d].open}
                  onChange={(e) => setDay(d, { open: e.target.value })}
                  className="h-10 rounded-md border-[1.5px] border-line-strong bg-white px-2 text-sm font-bold text-ink outline-none focus:border-harissa"
                />
                <span className="text-muted-soft">—</span>
                <input
                  type="time"
                  value={hours[d].close}
                  onChange={(e) => setDay(d, { close: e.target.value })}
                  className="h-10 rounded-md border-[1.5px] border-line-strong bg-white px-2 text-sm font-bold text-ink outline-none focus:border-harissa"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setDay(d, { closed: !hours[d].closed })}
              className={`h-9 px-3 rounded-md text-[12px] font-extrabold cursor-pointer transition-colors ${
                hours[d].closed ? "bg-teal-tint text-teal-pressed" : "border-[1.5px] border-line-strong text-muted"
              }`}
            >
              {hours[d].closed ? t.hours.openLabel : t.hours.closed}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Cat {
  id: string;
  name: string;
  items: { id: string; name: string; price: string }[];
}

function MenuStep({ defaultLang, onValidChange }: { defaultLang: Language; onValidChange: (v: boolean) => void }) {
  const { t, tr } = useI18n();
  const { restaurant } = usePortal();
  const supabase = getSupabase();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [showImport, setShowImport] = useState(false);

  const loadMenu = useCallback(async () => {
    const { data: catRows } = await supabase
      .from("categories")
      .select("id, name_i18n, sort_order")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order");
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, category_id, name_i18n, price_millimes, sort_order")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order");
    const mapped: Cat[] = (catRows ?? []).map((c) => ({
      id: c.id as string,
      name: tr(c.name_i18n as Record<string, string>),
      items: (itemRows ?? [])
        .filter((i) => i.category_id === c.id)
        .map((i) => ({
          id: i.id as string,
          name: tr(i.name_i18n as Record<string, string>),
          price: ((i.price_millimes as number) / 1000).toString(),
        })),
    }));
    setCats(mapped);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id, supabase]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    onValidChange(cats.some((c) => c.items.length > 0));
  }, [cats, onValidChange]);

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    const { data } = await supabase
      .from("categories")
      .insert({ restaurant_id: restaurant.id, name_i18n: { [defaultLang]: name }, sort_order: cats.length })
      .select("id")
      .single();
    if (data) setCats((prev) => [...prev, { id: data.id as string, name, items: [] }]);
    setNewCat("");
  };

  const addItem = async (catId: string, name: string, price: string) => {
    const millimes = toMillimes(price);
    if (!name.trim() || millimes === null) return;
    const cat = cats.find((c) => c.id === catId);
    const { data } = await supabase
      .from("items")
      .insert({
        restaurant_id: restaurant.id,
        category_id: catId,
        name_i18n: { [defaultLang]: name.trim() },
        price_millimes: millimes,
        sort_order: cat?.items.length ?? 0,
      })
      .select("id")
      .single();
    if (data)
      setCats((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, items: [...c.items, { id: data.id as string, name: name.trim(), price }] } : c)),
      );
  };

  if (!loaded) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="flex flex-col gap-4">
      <StepHeading title={t.onboarding.stepMenu} body={t.onboarding.stepMenuBody} />

      <button
        type="button"
        onClick={() => setShowImport(true)}
        className="flex items-center justify-center gap-1.5 h-12 rounded-xl border-[1.5px] border-harissa bg-harissa-tint text-harissa-pressed font-extrabold text-[14px] cursor-pointer hover:bg-[#F2DCCE] transition-colors"
      >
        {t.portal.menu.import.button}
        <span className="text-[12px] font-bold opacity-75">· {t.portal.menu.import.buttonHint}</span>
      </button>

      {cats.map((c) => (
        <div key={c.id} className="border border-line rounded-xl p-3.5 flex flex-col gap-2.5">
          <span className="font-extrabold text-[14px] text-ink">{c.name}</span>
          {c.items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-[13px]">
              <span className="flex-1 font-bold text-ink truncate">{i.name}</span>
              <span className="font-bold text-muted-soft" dir="ltr">
                {i.price} TND
              </span>
            </div>
          ))}
          <AddItemRow onAdd={(name, price) => void addItem(c.id, name, price)} />
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          placeholder={t.onboarding.categoryPlaceholder}
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addCategory();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void addCategory()}
          className="h-11 px-4 rounded-md bg-ink text-cream font-extrabold text-sm cursor-pointer whitespace-nowrap"
        >
          {t.onboarding.addCategory}
        </button>
      </div>

      {!cats.some((c) => c.items.length > 0) && <p className="text-[12px] font-bold text-muted-soft">{t.onboarding.needItem}</p>}

      {showImport && (
        <MenuImport
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            void loadMenu();
          }}
        />
      )}
    </div>
  );
}

function AddItemRow({ onAdd }: { onAdd: (name: string, price: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const submit = () => {
    if (!name.trim() || !price.trim()) return;
    onAdd(name, price);
    setName("");
    setPrice("");
  };
  return (
    <div className="flex items-center gap-2">
      <input
        className="h-10 flex-1 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa"
        placeholder={t.onboarding.itemNamePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
      />
      <input
        className="h-10 w-24 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa"
        placeholder={t.onboarding.itemPricePlaceholder}
        value={price}
        dir="ltr"
        inputMode="decimal"
        onChange={(e) => setPrice(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
      />
      <button type="button" onClick={submit} className="h-10 px-3 rounded-md bg-harissa-tint text-harissa-pressed font-extrabold text-[13px] cursor-pointer whitespace-nowrap">
        {t.onboarding.addItem}
      </button>
    </div>
  );
}

function AppearanceStep() {
  const { t } = useI18n();
  const { restaurant, refreshRestaurant } = usePortal();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void getSupabase()
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order")
      .overrideTypes<Category[], { merge: false }>()
      .then(({ data }) => setCategories(data ?? []));
  }, [restaurant.id]);

  return (
    <div className="flex flex-col gap-4">
      <StepHeading title={t.onboarding.stepAppearance} body={t.onboarding.stepAppearanceBody} />
      <AppearanceStudio restaurant={restaurant} categories={categories} onSaved={() => void refreshRestaurant()} />
    </div>
  );
}

function TablesStep() {
  const { t } = useI18n();
  const { restaurant } = usePortal();
  const supabase = getSupabase();
  const [count, setCount] = useState("8");
  const [zone, setZone] = useState("");
  const [existing, setExisting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCount = useCallback(async () => {
    const { count: c } = await supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id);
    setExisting(c ?? 0);
  }, [supabase, restaurant.id]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  const generate = async () => {
    const n = Math.max(1, Math.min(100, Number.parseInt(count, 10) || 0));
    if (!n) return;
    setBusy(true);
    const start = existing ?? 0;
    const rows = Array.from({ length: n }, (_, i) => ({
      restaurant_id: restaurant.id,
      label: String(start + i + 1),
      zone: zone.trim(),
      sort_order: start + i,
    }));
    await supabase.from("tables").insert(rows);
    await loadCount();
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <StepHeading title={t.onboarding.stepTables} body={t.onboarding.stepTablesBody} />
      {existing !== null && existing > 0 ? (
        <span className="text-[13px] font-extrabold text-success-text bg-success-tint rounded-lg px-3.5 py-2.5">
          ✓ {t.onboarding.tablesCreated.replace("{n}", String(existing))}
        </span>
      ) : (
        <span className="text-[13px] font-bold text-muted-soft">{t.onboarding.noTablesYet}</span>
      )}
      <div className="flex gap-3 items-end">
        <FieldLabel label={t.onboarding.tableCount} className="w-32">
          <input className={inputClass} type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} dir="ltr" />
        </FieldLabel>
        <FieldLabel label={t.onboarding.tableZone} className="flex-1">
          <input className={inputClass} placeholder={t.onboarding.tableZonePlaceholder} value={zone} onChange={(e) => setZone(e.target.value)} />
        </FieldLabel>
      </div>
      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy}
        className="h-11 rounded-lg bg-ink text-cream font-extrabold text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {busy ? <Spinner /> : t.onboarding.generateTables}
      </button>
    </div>
  );
}

function StaffStep() {
  const { t } = useI18n();
  const supabase = getSupabase();
  const { restaurant } = usePortal();
  const [rows, setRows] = useState<{ id: string; display_name: string; role: string }[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "waiter" | "kitchen">("waiter");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, display_name, role")
      .eq("restaurant_id", restaurant.id)
      .order("created_at");
    setRows((data as { id: string; display_name: string; role: string }[] | null) ?? []);
  }, [supabase, restaurant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleLabel: Record<string, string> = {
    owner: t.portal.staff.owner,
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
    await load();
  };

  return (
    <div className="flex flex-col gap-4">
      <StepHeading title={t.onboarding.stepStaff} body={t.onboarding.stepStaffBody} />

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-sand rounded-md px-3.5 py-2.5">
              <div className="w-8 h-8 rounded-full bg-teal-tint text-teal-pressed font-extrabold text-[13px] flex items-center justify-center shrink-0">
                {r.display_name.slice(0, 1).toUpperCase()}
              </div>
              <span className="flex-1 font-extrabold text-[13px] text-ink truncate">{r.display_name}</span>
              <span className="text-[11.5px] font-bold text-muted-soft">{roleLabel[r.role]}</span>
            </div>
          ))}
        </div>
      )}

      {created && (
        <div className="bg-success-tint rounded-lg p-3.5 flex flex-col gap-1.5 text-[13px]" dir="ltr">
          <span className="font-extrabold text-success-text">✓ {t.portal.staff.created}</span>
          <span className="font-bold text-ink break-all">{created.email}</span>
          <span className="font-mono font-bold text-ink break-all">{created.password}</span>
          <span className="text-[11px] text-muted">{t.portal.staff.credentialsBody}</span>
        </div>
      )}

      <div className="border border-line rounded-xl p-3.5 flex flex-col gap-3">
        <span className="font-extrabold text-[13px] text-ink">{t.portal.staff.addTitle}</span>
        <div className="flex gap-2">
          <input className="h-10 flex-1 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa" placeholder={t.portal.staff.displayName} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="h-10 flex-1 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa" placeholder={t.portal.staff.email} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
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
        <input className="h-10 rounded-md border-[1.5px] border-line-strong bg-white px-3 text-[13px] font-bold text-ink outline-none focus:border-harissa" placeholder={t.portal.staff.password} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-[12px] font-bold text-danger-text">{error}</p>}
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy}
          className="h-10 rounded-md bg-harissa-tint text-harissa-pressed font-extrabold text-[13px] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? <Spinner /> : t.portal.staff.create}
        </button>
      </div>
    </div>
  );
}

// ---- small shared bits ----
function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display font-extrabold text-lg text-ink">{title}</span>
      <span className="text-[13px] text-muted leading-relaxed">{body}</span>
    </div>
  );
}

function FieldLabel({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-extrabold text-muted-soft tracking-wide uppercase">{label}</span>
      {children}
    </div>
  );
}

function NextButton({ step, menuValid, onNext }: { step: number; menuValid: boolean; onNext: () => void }) {
  const { t } = useI18n();
  const disabled = step === 2 && !menuValid;
  return (
    <button
      type="button"
      onClick={onNext}
      disabled={disabled}
      className="h-12 px-6 rounded-lg bg-harissa text-white font-extrabold text-[15px] shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors cursor-pointer disabled:opacity-50"
    >
      {t.onboarding.next}
    </button>
  );
}
