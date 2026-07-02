import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@chehia/shared"],
  async redirects() {
    return [
      { source: "/business", destination: "/business/orders", permanent: false },
    ];
  },
};

export default nextConfig;
