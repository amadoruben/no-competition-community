import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle (node .next/standalone/server.js) for any
  // Node host or container; Vercel ignores this and uses its own packaging.
  output: "standalone",
  poweredByHeader: false,
  // Migrations ship with the server so DB_AUTO_MIGRATE works in standalone deployments.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  // Native/WASM database drivers stay out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: {
    serverActions: { bodySizeLimit: "3mb" }, // 2 MB image uploads + form overhead
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
