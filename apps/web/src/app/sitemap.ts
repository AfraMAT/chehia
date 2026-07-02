import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the marketing landing page is indexable; customer/portal routes are
// per-tenant and gated, so they are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "monthly", priority: 1 }];
}
