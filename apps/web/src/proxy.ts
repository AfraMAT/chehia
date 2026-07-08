import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host-based routing for the chehia.app subdomains, on a single Next.js app:
 *   chehia.app / www        → marketing landing (app/page.tsx) — default
 *   app.chehia.app          → consumer discovery (/app)
 *   business.chehia.app     → business portal (/business/orders)
 *   caisse.chehia.app       → staff point-of-sale register (/caisse)
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
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const sub = hostname.split(".")[0];
  const { pathname, search } = request.nextUrl;

  // Canonicalize the consumer app to a single URL (app.chehia.app) in production.
  // The discovery page is otherwise reachable at chehia.app/app (apex path) AND
  // app.chehia.app/app (subdomain path) as well as app.chehia.app/. On localhost
  // and preview there are no subdomains, so path access to /app is left intact.
  // Matched precisely ("/app" or "/app/…") so /apple-icon etc. are untouched.
  if (process.env.VERCEL_ENV === "production" && (pathname === "/app" || pathname.startsWith("/app/"))) {
    const rest = pathname.slice(4) || "/"; // strip "/app"
    const isApex = hostname === "chehia.app" || hostname === "www.chehia.app";
    if (isApex) {
      return NextResponse.redirect(`https://app.chehia.app${rest}${search}`, 308);
    }
    if (sub === "app") {
      return NextResponse.redirect(new URL(`${rest}${search}`, request.url), 308);
    }
  }

  if (pathname !== "/") {
    return NextResponse.next();
  }

  if (sub === "app") {
    return NextResponse.rewrite(new URL("/app", request.url));
  }
  if (sub === "business") {
    return NextResponse.redirect(new URL("/business/orders", request.url));
  }
  if (sub === "caisse") {
    return NextResponse.redirect(new URL("/caisse", request.url));
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
