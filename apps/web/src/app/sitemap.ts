import type { MetadataRoute } from "next";
import { SITE_URL, APP_URL } from "@/lib/site";

// Public, indexable pages only: the marketing landing, the legal pages, and the
// consumer discovery home. Per-tenant customer/portal/admin routes are gated and
// intentionally excluded (see robots.ts).
//
// This one document is served on every host. A crawler only honours the entries
// that match the host it fetched the sitemap from, so APP_URL is covered by the
// copy at app.chehia.app/sitemap.xml and the SITE_URL entries by the one at
// chehia.app/sitemap.xml — robots.ts advertises both.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: APP_URL, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
