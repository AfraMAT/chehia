"use client";

import { usePathname } from "next/navigation";
import { PortalProvider } from "./portal-provider";
import { PortalFooter } from "./portal-footer";
import { Sidebar } from "./sidebar";
import { InstallBanner } from "@/components/install-banner";

/**
 * Portal shell. Login, the kitchen display (full-screen dark), and the print
 * view render without the sidebar chrome. A device-aware "install / add to home
 * screen" banner sits above the content on the normal chrome.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
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
            <InstallBanner surface="business" />
            <div className="flex-1 min-w-0 flex flex-col">{children}</div>
            <PortalFooter />
          </div>
        </div>
      )}
    </PortalProvider>
  );
}
