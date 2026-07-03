// The canonical production origin. Hardcoded on purpose: SEO artifacts
// (sitemap, robots, Open Graph) and the printed-QR / table links must never
// depend on a hosting-dashboard env var being set correctly — a stale
// NEXT_PUBLIC_BASE_URL once pointed these at the wrong domain. The domain is
// fixed, so a constant is both simpler and safer.
export const SITE_URL = "https://chehia.app";

/**
 * Consumer app origin — where the scan → order experience lives (and the mobile
 * app's universal-link domain). Printed QR / table links point here so a scan
 * lands on app.chehia.app. Legacy chehia.app/r/... links still resolve (the
 * routes exist on the apex host too), so old printed codes keep working.
 */
export const APP_URL = "https://app.chehia.app";

/**
 * Origin to embed in printed QR codes and table links. In dev we point at the
 * local server; on preview deployments at the deployment's own origin (so the
 * full scan → order flow can be tested end-to-end against the dev backend);
 * in production at the consumer app origin — never an env var, so it can never
 * be mispointed.
 */
export function qrOrigin(): string {
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  if (
    process.env.NEXT_PUBLIC_DEPLOY_ENV === "preview" &&
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN
  ) {
    return process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
  }
  return APP_URL;
}
