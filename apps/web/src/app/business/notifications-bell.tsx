"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatQty, formatRelativeTime, interpolate, type AppNotification } from "@chehia/shared";
import { getSupabase } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";
import { usePortal } from "./portal-provider";
import { useInventoryUnit } from "./inventory/unit-label";

/**
 * Portal notification bell: live low/out-of-stock alerts (and any future
 * notification type). Subscribes to the venue's notifications via Realtime,
 * shows an unread badge, and renders each alert localized from its data.
 */
export function NotificationsBell() {
  const { restaurant } = usePortal();
  const { t, lang } = useI18n();
  const router = useRouter();
  const unitLabel = useInventoryUnit();
  const supabase = getSupabase();
  const n = t.portal.notifications;

  const [rows, setRows] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .overrideTypes<AppNotification[], { merge: false }>();
    setRows(data ?? []);
  }, [restaurant.id, supabase]);

  useEffect(() => {
    void reload();
    const channel = supabase
      .channel(`notif-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `restaurant_id=eq.${restaurant.id}` },
        () => void reload(),
      )
      // Re-fetch once the channel is live: alerts raised during subscription
      // setup (e.g. the inventory page's on-load sync) arrive before the
      // listener is attached, so this closes that startup race.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void reload();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, reload, supabase]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = rows.filter((r) => !r.is_read).length;

  const markAllRead = async () => {
    setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("restaurant_id", restaurant.id)
      .eq("is_read", false);
  };

  const openNotification = async (row: AppNotification) => {
    setOpen(false);
    if (!row.is_read) {
      await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", row.id);
    }
    if (row.inventory_item_id || row.type.startsWith("stock_")) router.push("/business/inventory");
    void reload();
  };

  const title = (row: AppNotification): string => {
    const name = String(row.data?.name ?? "");
    if (row.type === "stock_out") return interpolate(n.stockOut, { name });
    if (row.type === "stock_low") return interpolate(n.stockLow, { name });
    return name || n.title;
  };

  const body = (row: AppNotification): string => {
    if (row.type === "stock_out") return n.outNow;
    if (row.type === "stock_low") {
      return interpolate(n.remaining, {
        qty: formatQty(Number(row.data?.qty ?? 0), lang),
        unit: unitLabel(String(row.data?.unit ?? "")),
      });
    }
    return "";
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={n.aria}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-sand transition-colors cursor-pointer"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-[19px] h-[19px]" aria-hidden>
          <path
            d="M12 3a5 5 0 0 0-5 5v3.5c0 .8-.3 1.6-.9 2.2L5 15h14l-1.1-1.3a3 3 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-harissa text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={n.title}
          className="absolute top-full mt-2 start-0 z-50 w-[310px] max-h-[70dvh] overflow-hidden bg-card border border-line rounded-2xl shadow-xl flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
            <span className="font-extrabold text-[14px] text-ink">{n.title}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[11.5px] font-bold text-harissa-pressed hover:underline cursor-pointer"
              >
                {n.markAllRead}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-1 text-center">
                <span className="font-extrabold text-[14px] text-ink">{n.empty}</span>
                <span className="text-[12.5px] text-muted-soft">{n.emptyBody}</span>
              </div>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void openNotification(row)}
                  className={`w-full text-start px-4 py-3 border-b border-line last:border-b-0 hover:bg-sand transition-colors cursor-pointer flex gap-2.5 ${
                    row.is_read ? "" : "bg-harissa-tint/40"
                  }`}
                >
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      row.severity === "critical" ? "bg-danger" : row.severity === "warning" ? "bg-warning" : "bg-teal"
                    }`}
                  />
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-bold text-[13px] text-ink leading-snug">{title(row)}</span>
                    {body(row) && <span className="text-[12px] text-muted leading-snug">{body(row)}</span>}
                    <span className="text-[11px] font-semibold text-muted-soft">{formatRelativeTime(row.created_at, lang)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
