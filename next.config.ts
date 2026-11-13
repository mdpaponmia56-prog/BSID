import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "sharp", "pdfkit"],
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./assets/**/*",
      "./public/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
