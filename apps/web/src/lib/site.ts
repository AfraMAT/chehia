// The canonical production origin. Hardcoded on purpose: SEO artifacts
// (sitemap, robots, Open Graph) and the printed-QR / table links must never
// depend on a hosting-dashboard env var being set correctly — a stale
// NEXT_PUBLIC_BASE_URL once pointed these at the wrong domain. The domain is
// fixed, so a constant is both simpler and safer.
export const SITE_URL = "https://chehia.app";

/**
 * Origin to embed in printed QR codes and table links. In dev we point at the
 * local server; in production we use the canonical origin (which matches the
 * mobile app's universal-link domain), independent of any env var.
 */
export function qrOrigin(): string {
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : SITE_URL;
}
