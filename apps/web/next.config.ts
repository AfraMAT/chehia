import type { NextConfig } from "next";

// Vercel exposes VERCEL_ENV ("production" | "preview" | "development") and
// VERCEL_BRANCH_URL at build time. We inline them here — values in `env` are
// always bundled into the client (Next's `env` config uses webpack DefinePlugin)
// — so the browser can select the right Supabase project and QR origin per
// deployment without any dashboard configuration. See src/lib/supabase.ts and
// src/lib/site.ts.
const previewOrigin = process.env.VERCEL_BRANCH_URL
  ? `https://${process.env.VERCEL_BRANCH_URL}`
  : "";

// Baseline security headers, applied to every route. Deliberately conservative:
// `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` kill cross-origin
// clickjacking (the real threat to the POS/admin/business portals) without a
// full CSP, which would need per-request nonces to avoid breaking Next's inline
// runtime. HSTS has no `preload` (that commitment is a deliberate, separate step).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version (reconnaissance hardening).
  poweredByHeader: false,
  transpilePackages: ["@chehia/shared"],
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_PREVIEW_ORIGIN: previewOrigin,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/business", destination: "/business/orders", permanent: false },
    ];
  },
};

export default nextConfig;
