import type { Metadata } from "next";
import { PortalShell } from "./portal-shell";

// Install as a distinct "Chehia Business" home-screen / desktop app (overrides
// the site-wide manifest). Mirrors the caisse layout's per-surface manifest.
export const metadata: Metadata = {
  manifest: "/business.webmanifest",
};

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
