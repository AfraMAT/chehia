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
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  // On preview deployments (the `develop` branch) point QR / table links at the
  // deployment's own origin, so the full scan → order flow can be tested
  // end-to-end against the dev backend. Production always uses the hardcoded
  // canonical origin — never an env var — so it can never be mispointed.
  if (
    process.env.NEXT_PUBLIC_DEPLOY_ENV === "preview" &&
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN
  ) {
    return process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
  }
  return SITE_URL;
}
