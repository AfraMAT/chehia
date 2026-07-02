"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildTableUrl, interpolate, type Table } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { usePortal } from "../portal-provider";
import { QrImage } from "./qr-image";
import { TableCard } from "./table-card";

/** W4 · Tables & QR — permanent QR per table, printable branded cards. */
export default function TablesPage() {
  const { restaurant, canManage } = usePortal();
  const { t, tr } = useI18n();
  const supabase = getSupabase();
  const router = useRouter();

  const [tables, setTables] = useState<Table[]>([]);
  const [preview, setPreview] = useState<Table | null>(null);
  const [adding, setAdding] = useState(false);

  // Table management is owner/manager only.
  useEffect(() => {
    if (!canManage) router.replace("/business/orders");
  }, [canManage, router]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order")
      .overrideTypes<Table[], { merge: false }>();
    setTables(data ?? []);
    setPreview((prev) => prev ?? data?.[0] ?? null);
  }, [restaurant.id, supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addTables = async () => {
    const countStr = window.prompt(`${t.portal.tables.addTablesTitle} — ${t.portal.tables.count}`, "1");
    const count = Number(countStr);
    if (!Number.isInteger(count) || count < 1 || count > 50) return;
    const zone = window.prompt(t.portal.tables.zone, "Salle") ?? "";
    setAdding(true);
    // Continue from the highest existing numeric label (counting rows would
    // produce duplicates after deactivations).
    const highest = Math.max(0, ...tables.map((tb) => Number.parseInt(tb.label, 10) || 0));
    const rows = Array.from({ length: count }, (_, i) => ({
      restaurant_id: restaurant.id,
      label: String(highest + i + 1).padStart(2, "0"),
      zone,
      sort_order: highest + i + 1,
    }));
    await supabase.from("tables").insert(rows);
    setAdding(false);
    await reload();
  };

  const downloadCard = async (table: Table) => {
    // Open the print view scoped to one table.
    window.open(`/business/tables/print?table=${table.id}`, "_blank");
  };

  const urlFor = (table: Table) => buildTableUrl(baseUrl, { slug: restaurant.slug, qrToken: table.qr_token });

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="flex items-center gap-3 px-6 pt-5 pb-3.5 flex-wrap">
        <h1 className="font-display font-extrabold text-2xl text-ink">{t.portal.tables.title}</h1>
        <span className="text-[12.5px] font-bold text-muted bg-card border border-line rounded-full px-3.5 py-1.5">
          {tables.length} {t.portal.tables.permanent}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void addTables()}
          disabled={adding}
          className="text-[13px] font-extrabold text-ink border-[1.5px] border-line-strong bg-card rounded-md px-4 py-2.5 cursor-pointer hover:border-ink transition-colors disabled:opacity-50"
        >
          {t.portal.tables.addTables}
        </button>
        <Link
          href="/business/tables/print"
          target="_blank"
          className="text-[13px] font-extrabold text-white bg-harissa rounded-md px-4 py-2.5 shadow-[0_4px_12px_rgba(188,75,38,0.25)] hover:bg-harissa-pressed transition-colors"
        >
          {interpolate(t.portal.tables.printCards, { n: tables.length })}
        </Link>
      </div>

      <div className="flex-1 flex gap-4.5 px-6 pb-5 items-start gap-5">
        {/* Table grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 content-start min-w-0">
          {tables.map((table) => (
            <div key={table.id} className="bg-card border border-line rounded-xl p-3.5 flex flex-col gap-2.5">
              <button type="button" onClick={() => setPreview(table)} className="flex items-center gap-3 cursor-pointer text-start">
                <div className="w-[58px] h-[58px] rounded-md bg-white border border-line p-1 shrink-0">
                  <QrImage url={urlFor(table)} size={48} className="!rounded-sm" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-extrabold text-[15px] text-ink">
                    {t.common.table} {table.label}
                  </span>
                  <span className="text-[11.5px] font-bold text-muted-soft truncate">{table.zone}</span>
                </div>
              </button>
              <div className="flex gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => void downloadCard(table)}
                  className="flex-1 h-[34px] rounded-sm border-[1.5px] border-line-strong text-ink font-extrabold text-[11.5px] cursor-pointer hover:border-ink transition-colors"
                >
                  {t.portal.tables.download}
                </button>
                <a
                  href={urlFor(table)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-[34px] rounded-sm border-[1.5px] border-line-strong text-ink font-extrabold text-[11.5px] flex items-center justify-center hover:border-ink transition-colors"
                >
                  {t.portal.tables.test}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Card preview */}
        {preview && (
          <div className="w-[390px] shrink-0 bg-card border border-line rounded-2xl p-5 flex flex-col items-center gap-3.5 sticky top-4">
            <div className="self-stretch flex items-center justify-between">
              <span className="font-extrabold text-sm text-ink">{t.portal.tables.cardTitle}</span>
              <span className="text-[11px] font-extrabold text-teal-pressed bg-teal-tint rounded-full px-2.5 py-1">
                {t.portal.tables.cardFormat}
              </span>
            </div>
            <TableCard
              url={urlFor(preview)}
              tableLabel={preview.label}
              venueName={restaurant.name}
              venueAddress={tr(restaurant.tagline_i18n) || restaurant.city}
            />
            <p className="text-[11.5px] leading-relaxed text-muted-soft text-center whitespace-pre-line">
              {t.portal.tables.qrHint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
