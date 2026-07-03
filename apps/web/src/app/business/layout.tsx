"use client";

import { usePathname } from "next/navigation";
import { PortalProvider } from "./portal-provider";
import { PortalFooter } from "./portal-footer";
import { Sidebar } from "./sidebar";

/**
 * Portal shell. Login, the kitchen display (full-screen dark), and the print
 * view render without the sidebar chrome.
 */
export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/business/login") {
    return <>{children}</>;
  }

  const bare =
    pathname.startsWith("/business/kitchen") ||
    pathname.startsWith("/business/tables/print") ||
    pathname.startsWith("/business/onboarding");

  return (
    <PortalProvider>
      {bare ? (
        <>{children}</>
      ) : (
        <div className="min-h-dvh bg-sand flex">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-w-0 flex flex-col">{children}</div>
            <PortalFooter />
          </div>
        </div>
      )}
    </PortalProvider>
  );
}
