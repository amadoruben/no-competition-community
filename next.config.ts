import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App is authenticated and data-driven: every page renders per request.
  serverExternalPackages: ["better-sqlite3"],
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
