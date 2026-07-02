"use client";

import { usePathname } from "next/navigation";
import { AdminProvider } from "./admin-provider";

/** Admin shell. The login route renders without the auth guard. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return <AdminProvider>{children}</AdminProvider>;
}
