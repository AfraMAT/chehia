import type { MetadataRoute } from "next";

// The landing page is public; the business portal and per-table customer
// ordering pages should not be indexed.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://chahia.app";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/business", "/r/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
