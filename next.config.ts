import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || "";
const deployVersion = (process.env.DEPLOY_VERSION || process.env.GITHUB_SHA || `local-${Date.now().toString(36)}`).slice(0, 16);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.88.200"],
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_DEPLOY_VERSION: deployVersion,
  },
};

export default nextConfig;
