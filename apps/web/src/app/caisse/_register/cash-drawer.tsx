"use client";

import { useEffect, useState } from "react";
import { interpolate } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse, type CashReport } from "../caisse-provider";
import { money } from "./util";

/** Parse a dinar amount ("20" / "20,500") into millimes. */
function tndToMillimes(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 1000)) : 0;
}

/** Cash drawer: open with a float, watch the running Z, close with a count. */
export function CashDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const methodLabel: Record<string, string> = {
    cash: t.caisse.tender.cash,
    card: t.caisse.tender.card,
    d17: t.caisse.tender.d17,
    other: t.caisse.tender.other,
  };
  const { cashSession, openCashSession, closeCashSession, getCashReport } = useCaisse();
  const [floatStr, setFloatStr] = useState("");
  const [countStr, setCountStr] = useState("");
  const [report, setReport] = useState<CashReport | null>(null);
  const [closed, setClosed] = useState<{ expected: number; counted: number; overShort: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cashSession) void getCashReport().then(setReport);
  }, [cashSession, getCashReport]);

  const doOpen = async () => {
    setBusy(true);
    setError(null);
    const res = await openCashSession(tndToMillimes(floatStr));
    setBusy(false);
    if (!res.ok) setError(t.caisse.drawer.openError);
  };

  const doClose = async () => {
    setBusy(true);
    setError(null);
    const res = await closeCashSession(tndToMillimes(countStr));
    setBusy(false);
    if (!res.ok) {
      setError(t.caisse.drawer.closeError);
      return;
    }
    setClosed({
      expected: res.session.expected_cash_millimes ?? 0,
      counted: res.session.counted_cash_millimes ?? 0,
      overShort: res.session.over_short_millimes ?? 0,
    });
  };

  return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
        <span className="font-display font-extrabold text-[18px] text-ink">{t.caisse.drawer.title}</span>
        <button type="button" onClick={onClose} aria-label={t.caisse.common.close} className="w-9 h-9 rounded-full bg-white border border-line text-ink font-extrabold cursor-pointer">✕</button>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <ShiftSection />
        {closed ? (
          <ZReport closed={closed} onDone={onClose} />
        ) : cashSession ? (
          <>
            {/* Running Z */}
            <div className="bg-sand rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-muted-soft">{t.caisse.drawer.sessionOpen}</span>
              <Row l={t.caisse.drawer.float} r={money(cashSession.opening_float_millimes)} />
              {report && (
                <>
                  <Row l={t.caisse.drawer.sales} r={money(report.sales_total_millimes)} />
                  {Object.entries(report.by_method).map(([m, v]) => (
                    <Row key={m} l={`· ${methodLabel[m] ?? m}`} r={money(v)} sub />
                  ))}
                  <Row l={t.caisse.drawer.orders} r={String(report.orders_count)} />
                </>
              )}
            </div>

            {/* Close */}
            <div className="flex flex-col gap-2">
              <label htmlFor="count" className="text-[13px] font-bold text-ink">{t.caisse.drawer.countLabel}</label>
              <input
                id="count"
                inputMode="decimal"
                value={countStr}
                onChange={(e) => setCountStr(e.target.value)}
                placeholder="0,000"
                className="h-12 rounded-xl border-[1.5px] border-line-strong bg-white px-4 text-[16px] text-ink outline-none focus:border-harissa tabular-nums"
              />
              {error && <p className="text-[13px] font-bold text-danger-text">{error}</p>}
              <button
                type="button"
                onClick={doClose}
                disabled={busy}
                className="h-[52px] rounded-xl bg-ink text-cream font-extrabold text-[15px] cursor-pointer disabled:opacity-60"
              >
                {busy ? t.caisse.drawer.closing : t.caisse.drawer.closeZ}
              </button>
            </div>
          </>
        ) : (
          /* Open */
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-muted leading-relaxed">{t.caisse.drawer.openHint}</p>
            <label htmlFor="float" className="text-[13px] font-bold text-ink mt-1">{t.caisse.drawer.floatLabel}</label>
            <input
              id="float"
              inputMode="decimal"
              value={floatStr}
              onChange={(e) => setFloatStr(e.target.value)}
              placeholder="0,000"
              className="h-12 rounded-xl border-[1.5px] border-line-strong bg-white px-4 text-[16px] text-ink outline-none focus:border-harissa tabular-nums"
            />
            {error && <p className="text-[13px] font-bold text-danger-text">{error}</p>}
            <button
              type="button"
              onClick={doOpen}
              disabled={busy}
              className="h-[52px] rounded-xl bg-harissa text-white font-extrabold text-[15px] cursor-pointer hover:bg-harissa-pressed transition-colors disabled:opacity-60"
            >
              {busy ? t.caisse.drawer.opening : t.caisse.drawer.open}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function ZReport({ closed, onDone }: { closed: { expected: number; counted: number; overShort: number }; onDone: () => void }) {
  const { t } = useI18n();
  const over = closed.overShort;
  const tone = over === 0 ? "text-teal-pressed" : over > 0 ? "text-teal-pressed" : "text-danger-text";
  return (
    <div className="flex flex-col gap-3">
      <span className="font-display font-extrabold text-xl text-ink text-center">{t.caisse.drawer.closedTitle}</span>
      <div className="bg-sand rounded-xl p-4 flex flex-col gap-2">
        <Row l={t.caisse.drawer.expected} r={money(closed.expected)} />
        <Row l={t.caisse.drawer.counted} r={money(closed.counted)} />
        <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-line">
          <span className="font-extrabold text-[15px] text-ink">{t.caisse.drawer.variance}</span>
          <span className={`font-display font-extrabold text-[22px] tabular-nums ${tone}`} dir="ltr">
            {over > 0 ? "+" : ""}{money(over)}
          </span>
        </div>
      </div>
      <button type="button" onClick={onDone} className="h-[52px] rounded-xl bg-ink text-cream font-extrabold text-[15px] cursor-pointer">
        {t.caisse.drawer.done}
      </button>
    </div>
  );
}

function formatDur(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ShiftSection() {
  const { t } = useI18n();
  const { myShift, clockIn, clockOut } = useCaisse();
  const [busy, setBusy] = useState(false);
  const dur = myShift ? formatDur(Date.now() - new Date(myShift.clock_in).getTime()) : null;
  return (
    <div className="bg-sand rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-[11px] font-extrabold tracking-wider uppercase text-muted-soft">{t.caisse.drawer.myShift}</span>
        {myShift ? (
          <span className="text-[14px] font-bold text-ink">{interpolate(t.caisse.drawer.onShift, { dur: dur ?? "" })}</span>
        ) : (
          <span className="text-[13px] text-muted-soft">{t.caisse.drawer.offShift}</span>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          if (myShift) await clockOut();
          else await clockIn();
          setBusy(false);
        }}
        className={`h-10 px-4 rounded-lg font-extrabold text-[13px] cursor-pointer disabled:opacity-60 ${myShift ? "bg-ink text-cream" : "bg-harissa text-white hover:bg-harissa-pressed"}`}
      >
        {myShift ? t.caisse.drawer.clockOut : t.caisse.drawer.clockIn}
      </button>
    </div>
  );
}

function Row({ l, r, sub }: { l: string; r: string; sub?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={sub ? "text-[12px] text-muted-soft ps-2" : "text-[13px] text-muted"}>{l}</span>
      <span className={`tabular-nums ${sub ? "text-[12px] text-muted-soft" : "text-[13px] font-bold text-ink"}`} dir="ltr">{r}</span>
    </div>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button aria-label={t.caisse.common.close} className="absolute inset-0 bg-ink/50 cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-[400px] max-h-[92dvh] overflow-y-auto bg-cream rounded-2xl shadow-[0_20px_60px_rgba(34,26,19,0.4)]">
        {children}
      </div>
    </div>
  );
}
