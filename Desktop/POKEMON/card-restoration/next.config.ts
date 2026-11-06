import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Netlify builds serve resized photo thumbnails (lib/thumbnail.ts)
    IMAGE_CDN: process.env.NETLIFY === "true" ? "netlify" : "",
  },
};

export default nextConfig;
