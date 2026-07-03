import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The landing page is public; the business portal and per-table customer
// ordering pages should not be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/business", "/r/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
