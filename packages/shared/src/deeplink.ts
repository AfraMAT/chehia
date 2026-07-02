/**
 * QR deep-link scheme.
 * Each printed table QR encodes: https://{host}/r/{restaurantSlug}/t/{qrToken}
 * - App installed → OS opens the app via universal/app links to the same path.
 * - Not installed → the Next.js web app serves the ordering experience.
 * The QR is permanent; the destination stays dynamic.
 */

export interface TableLink {
  slug: string;
  qrToken: string;
}

export function buildTableUrl(baseUrl: string, link: TableLink): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/r/${encodeURIComponent(link.slug)}/t/${encodeURIComponent(link.qrToken)}`;
}

/** Parse /r/{slug}/t/{token} from a URL or path; null when it's not a table link. */
export function parseTableUrl(urlOrPath: string): TableLink | null {
  let path = urlOrPath;
  try {
    path = new URL(urlOrPath).pathname;
  } catch {
    // already a path
  }
  const match = path.match(/^\/r\/([a-z0-9-]+)\/t\/([A-Za-z0-9_-]+)\/?$/);
  if (!match || !match[1] || !match[2]) return null;
  return { slug: match[1], qrToken: match[2] };
}
