"use client";

import { useState } from "react";
import { LANGUAGE_LABELS, LANGUAGES, buildLine, interpolate, type MenuItem } from "@chehia/shared";
import { useI18n } from "@/components/i18n-provider";
import { useCaisse, type OrderType } from "../caisse-provider";
import { ProductGrid } from "./product-grid";
import { Ticket } from "./ticket";
import { ModifierSheet } from "./modifier-sheet";
import { TenderSheet } from "./tender-sheet";
import { TableSheet } from "./table-sheet";
import { CashDrawer } from "./cash-drawer";
import { LockScreen } from "./lock-screen";
import { money } from "./util";

const ORDER_TYPE_KEYS: OrderType[] = ["comptoir", "emporter", "surplace"];

/** The register — header (routing) + product grid + ticket, orchestrating the sheets. */
export function Register() {
  const { t, lang, setLang } = useI18n();
  const { restaurant, staff, orderType, setOrderType, table, groupsByItem, addToTicket, ticketCount, ticketTotal, cashSession, online, pendingCount, failedCount, locked, lock, signOut } = useCaisse();
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [tableSheetOpen, setTableSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileTicketOpen, setMobileTicketOpen] = useState(false);

  const pick = (item: MenuItem) => {
    if ((groupsByItem[item.id]?.length ?? 0) > 0) {
      setModifierItem(item);
    } else {
      addToTicket(buildLine(item, [], [], 1));
    }
  };

  const chooseType = (t: OrderType) => {
    setOrderType(t);
    if (t === "surplace" && !table) setTableSheetOpen(true);
  };

  return (
    <div className="h-dvh flex flex-col bg-sand overflow-hidden" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Connectivity banner */}
      {(!online || pendingCount > 0 || failedCount > 0) && (
        <div className={`shrink-0 h-8 flex items-center justify-center gap-2 text-[12.5px] font-bold ${!online ? "bg-ink text-cream" : failedCount > 0 ? "bg-danger-tint text-danger-text" : "bg-teal-tint text-teal-pressed"}`}>
          {!online ? (
            <span>● {t.caisse.offline.banner}{pendingCount > 0 ? ` · ${interpolate(t.caisse.offline.pending, { n: pendingCount })}` : ""}</span>
          ) : failedCount > 0 ? (
            <span>⚠ {interpolate(t.caisse.offline.unsynced, { n: failedCount })}{pendingCount > 0 ? ` · ${interpolate(t.caisse.offline.pending, { n: pendingCount })}` : ""}</span>
          ) : (
            <span>{interpolate(t.caisse.offline.syncing, { n: pendingCount })}</span>
          )}
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 h-14 bg-card border-b border-line flex items-center gap-3 px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-extrabold text-[16px] text-ink truncate">{restaurant.name}</span>
          <span className="hidden sm:inline text-[10px] font-extrabold tracking-wider uppercase text-harissa-pressed bg-harissa-tint rounded px-1.5 py-0.5">{t.caisse.common.registerTag}</span>
        </div>

        {/* Order type */}
        <div className="flex-1 flex justify-center">
          <div className="flex rounded-xl bg-sand p-1 gap-1">
            {ORDER_TYPE_KEYS.map((ot) => (
              <button
                key={ot}
                type="button"
                onClick={() => chooseType(ot)}
                className={`h-9 px-3 sm:px-4 rounded-lg text-[13px] font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                  orderType === ot ? "bg-card text-harissa-pressed shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.caisse.orderType[ot]}
              </button>
            ))}
          </div>
        </div>

        {/* Table (sur place) + drawer + language + staff */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            title={t.caisse.drawer.tooltip}
            className="h-9 px-3 rounded-lg text-[12.5px] font-extrabold cursor-pointer transition-colors flex items-center gap-1.5 bg-sand text-ink hover:bg-harissa-tint"
          >
            <span className={`w-2 h-2 rounded-full ${cashSession ? "bg-teal" : "bg-disabled"}`} />
            {t.caisse.common.registerTag}
          </button>
          <button
            type="button"
            onClick={lock}
            title={t.caisse.lock.tooltip}
            className="h-9 w-9 rounded-lg bg-sand text-ink hover:bg-harissa-tint flex items-center justify-center cursor-pointer text-[15px]"
          >
            🔒
          </button>
          {/* Language toggle */}
          <div className="flex gap-0.5" dir="ltr">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`h-9 px-2 rounded-lg text-[11.5px] font-extrabold cursor-pointer transition-colors ${
                  lang === code ? "bg-ink text-cream" : "bg-sand text-muted hover:text-ink"
                }`}
              >
                {LANGUAGE_LABELS[code].slice(0, 2)}
              </button>
            ))}
          </div>
          {orderType === "surplace" && (
            <button
              type="button"
              onClick={() => setTableSheetOpen(true)}
              className={`h-9 px-3 rounded-lg text-[12.5px] font-extrabold cursor-pointer transition-colors ${
                table ? "bg-teal-tint text-teal-pressed" : "bg-danger-tint text-danger-text"
              }`}
            >
              {table ? interpolate(t.caisse.common.table, { label: table.label }) : t.caisse.common.chooseTable}
            </button>
          )}
          <div className="hidden md:flex flex-col items-end leading-tight">
            <span className="text-[12px] font-extrabold text-ink">{staff.display_name}</span>
            <button type="button" onClick={() => void signOut()} className="text-[10.5px] font-bold text-muted hover:text-danger-text cursor-pointer">
              {t.caisse.common.signOut}
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        <ProductGrid onPick={pick} />
        {/* Ticket rail (tablet/desktop) */}
        <aside className="hidden md:flex w-[360px] lg:w-[380px] shrink-0 border-s border-line">
          <Ticket onCheckout={() => setTenderOpen(true)} />
        </aside>
      </div>

      {/* Mobile ticket bar */}
      <button
        type="button"
        onClick={() => setMobileTicketOpen(true)}
        className="md:hidden shrink-0 h-16 bg-ink text-cream flex items-center justify-between px-5 cursor-pointer"
      >
        <span className="font-extrabold text-[15px]">{t.caisse.common.ticket} · {ticketCount}</span>
        <span className="font-display font-extrabold text-[20px] tabular-nums" dir="ltr">{money(ticketTotal)}</span>
      </button>

      {/* Mobile ticket overlay */}
      {mobileTicketOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col">
          <button aria-label={t.caisse.common.close} className="flex-1 bg-ink/50" onClick={() => setMobileTicketOpen(false)} />
          <div className="h-[78dvh] bg-card rounded-t-2xl overflow-hidden">
            <Ticket
              onCheckout={() => {
                setMobileTicketOpen(false);
                setTenderOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {modifierItem && <ModifierSheet item={modifierItem} onClose={() => setModifierItem(null)} />}
      {tenderOpen && <TenderSheet onClose={() => setTenderOpen(false)} />}
      {tableSheetOpen && <TableSheet onClose={() => setTableSheetOpen(false)} />}
      {drawerOpen && <CashDrawer onClose={() => setDrawerOpen(false)} />}
      {locked && <LockScreen />}
    </div>
  );
}
