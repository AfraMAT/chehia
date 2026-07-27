import type { MetadataRoute } from "next";
import { SITE_URL, APP_URL } from "@/lib/site";

// The landing page is public; the four gated surfaces — admin, business portal,
// Caisse register and the per-table customer ordering pages — should not be
// indexed. All of them stay reachable by path on every host (see proxy.ts), so
// they are disallowed by path, not by host.
//
// Both sitemap URLs are advertised because this route is served on every host and
// a crawler ignores sitemap entries outside the sitemap's own host: app.chehia.app
// only gets coverage from the copy served at app.chehia.app/sitemap.xml.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/business", "/caisse", "/r/"] }],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${APP_URL}/sitemap.xml`],
  };
}
