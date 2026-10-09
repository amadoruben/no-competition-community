import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/**
 * E2E runs against a production build with its own database, reseeded on
 * every run. Set E2E_DATABASE_URL to a real PostgreSQL (CI does); otherwise an
 * embedded PGlite directory is used.
 */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "pglite://data/e2e-pglite";
const env = `DATABASE_URL=${E2E_DATABASE_URL} APP_ENV=test AUTH_PROVIDER=local STORAGE_PROVIDER=local DEMO_MODE=1 INSECURE_COOKIES=1 STORAGE_LOCAL_DIR=data/e2e-uploads DB_AUTO_MIGRATE=1`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile|resilience/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile/ },
    { name: "resilience", use: { ...devices["Desktop Chrome"] }, testMatch: /resilience/ },
  ],
  webServer: {
    command: `rm -rf data/e2e-pglite data/e2e-uploads && env ${env} npx tsx src/db/seed.ts && env ${env} npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
