import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/graves/*/image": ["src/server/images/fonts/NotoSansJP-wght.ttf"],
    "/api/graves/*/keepsake": ["src/server/images/fonts/NotoSansJP-wght.ttf"],
  },
};

export default nextConfig;
