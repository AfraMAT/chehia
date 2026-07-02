"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { usePortal } from "./portal-provider";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { restaurant, staff, signOut, canManage } = usePortal();

  const items = [
    { href: "/business/orders", label: t.portal.nav.orders },
    { href: "/business/kitchen", label: t.portal.nav.kitchen },
    ...(canManage ? [{ href: "/business/menu", label: t.portal.nav.menu }] : []),
    ...(canManage ? [{ href: "/business/tables", label: t.portal.nav.tables }] : []),
    { href: "/business/stats", label: t.portal.nav.stats },
    ...(canManage ? [{ href: "/business/settings", label: t.portal.nav.settings }] : []),
  ];

  const roleLabel = {
    owner: t.portal.staff.owner,
    manager: t.portal.staff.manager,
    waiter: t.portal.staff.waiter,
    kitchen: t.portal.staff.kitchen,
  }[staff.role];

  return (
    <aside className="w-[218px] shrink-0 bg-card border-e border-line flex flex-col p-3.5 sticky top-0 h-dvh no-print">
      <Link href="/business/orders" className="flex items-center gap-2 px-2 pb-4">
        <Logo markSize={30} textSize={19} />
      </Link>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                active ? "bg-harissa-tint" : "hover:bg-sand"
              }`}
            >
              <span className={`w-2 h-2 rounded-[2.5px] shrink-0 ${active ? "bg-harissa" : "bg-disabled"}`} />
              <span className={`text-[13.5px] ${active ? "font-extrabold text-harissa-pressed" : "font-bold text-muted"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="bg-sand rounded-lg p-3 flex flex-col gap-0.5">
        <span className="font-extrabold text-[13px] text-ink truncate">{restaurant.name}</span>
        <span className="text-[11.5px] font-semibold text-muted-soft truncate">
          {restaurant.plan === "pro" ? "Plan Pro" : "Plan Starter"} · {staff.display_name} — {roleLabel}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 text-start text-[12px] font-bold text-muted hover:text-danger-text cursor-pointer"
        >
          {t.auth.signOut}
        </button>
      </div>
    </aside>
  );
}
