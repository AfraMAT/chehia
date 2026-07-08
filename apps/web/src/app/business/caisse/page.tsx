"use client";

import { useState } from "react";
import { usePortal } from "../portal-provider";
import { Reports } from "./reports";
import { FiscalSettings } from "./fiscal-settings";

/** Business "Caisse" — POS reports + fiscal configuration for the register. */
export default function CaissePage() {
  const { canManage } = usePortal();
  const [tab, setTab] = useState<"reports" | "fiscal">("reports");

  if (!canManage) {
    return (
      <div className="max-w-[760px] mx-auto p-6">
        <p className="text-sm text-muted">Réservé au propriétaire ou au gérant.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto p-6 flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="font-display font-extrabold text-2xl text-ink">Caisse</h1>
        <div className="flex rounded-xl bg-sand p-1 gap-1 w-fit">
          {([["reports", "Rapports"], ["fiscal", "Fiscalité"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`h-10 px-5 rounded-lg text-[14px] font-extrabold cursor-pointer transition-colors ${
                tab === key ? "bg-card text-harissa-pressed shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "reports" ? <Reports /> : <FiscalSettings />}
    </div>
  );
}
