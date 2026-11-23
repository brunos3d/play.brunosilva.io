import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser tests build into a folder of their own (see playwright.config.ts), so a test run never replaces the files a running `next dev` serves from `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
