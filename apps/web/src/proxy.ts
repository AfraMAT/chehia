import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host-based routing for the chehia.app subdomains, on a single Next.js app:
 *   chehia.app / www        → marketing landing (app/page.tsx) — default
 *   app.chehia.app          → consumer discovery (/app)
 *   business.chehia.app     → business portal (/business/orders)
 *   admin.chehia.app        → admin portal (/admin)
 *
 * Only the ROOT path ("/") is remapped per host, so every route still resolves
 * by path on a single host (previews, localhost) — e.g. the preview URL serves
 * the landing at "/", discovery at "/app", the portal at "/business", etc.
 *
 * The consumer home is a rewrite (keeps the clean "/" URL); the portals redirect
 * to their real path so `usePathname()` in their client layouts stays correct.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? "";
  const sub = host.split(":")[0].split(".")[0];

  if (sub === "app") {
    return NextResponse.rewrite(new URL("/app", request.url));
  }
  if (sub === "business") {
    return NextResponse.redirect(new URL("/business/orders", request.url));
  }
  if (sub === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on page routes only — skip API, Next internals, and metadata files.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|.well-known).*)",
  ],
};
