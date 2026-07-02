import type { MetadataRoute } from "next";

// Only the marketing landing page is indexable; customer/portal routes are
// per-tenant and gated, so they are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://chehia.app";
  return [{ url: base, changeFrequency: "monthly", priority: 1 }];
}
