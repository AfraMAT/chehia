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

const nextConfig: NextConfig = {
  transpilePackages: ["@chehia/shared"],
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_PREVIEW_ORIGIN: previewOrigin,
  },
  async redirects() {
    return [
      { source: "/business", destination: "/business/orders", permanent: false },
    ];
  },
};

export default nextConfig;
