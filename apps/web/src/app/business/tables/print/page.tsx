"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildTableUrl, type Table } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { usePortal } from "../../portal-provider";
import { TableCard } from "../table-card";

export default function PrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintCards />
    </Suspense>
  );
}

/** Print-ready sheet of A6 table cards; auto-opens the print dialog. */
function PrintCards() {
  const { restaurant } = usePortal();
  const searchParams = useSearchParams();
  const onlyTable = searchParams.get("table");
  const [tables, setTables] = useState<Table[]>([]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  useEffect(() => {
    void (async () => {
      let query = getSupabase()
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order");
      if (onlyTable) query = query.eq("id", onlyTable);
      const { data } = await query.overrideTypes<Table[], { merge: false }>();
      setTables(data ?? []);
    })();
  }, [restaurant.id, onlyTable]);

  useEffect(() => {
    if (tables.length > 0) {
      const id = setTimeout(() => window.print(), 700);
      return () => clearTimeout(id);
    }
  }, [tables.length]);

  return (
    <div className="min-h-dvh bg-white p-8">
      <div className="no-print mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 px-6 rounded-lg bg-harissa text-white font-extrabold text-sm cursor-pointer"
        >
          Imprimer / Print (PDF)
        </button>
        <span className="text-sm text-muted">
          {tables.length} carte{tables.length > 1 ? "s" : ""} · A6
        </span>
      </div>
      <div className="grid grid-cols-2 gap-8 max-w-[640px]">
        {tables.map((table) => (
          <div key={table.id} className="print-page flex justify-center">
            <TableCard
              url={buildTableUrl(baseUrl, { slug: restaurant.slug, qrToken: table.qr_token })}
              tableLabel={table.label}
              venueName={restaurant.name}
              venueAddress={restaurant.city}
              qrSize={150}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
