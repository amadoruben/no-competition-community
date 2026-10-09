import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Next.js marker package; irrelevant outside the React Server bundle.
      "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    // Each file gets its own isolated database (PGlite) — run files serially when sharing a server.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
