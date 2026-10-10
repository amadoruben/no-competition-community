import { expect, test } from "@playwright/test";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { INVESTOR, MEMBER, loginAs } from "./helpers";

/**
 * Persistence across restarts and behaviour while the database is down.
 * Needs a real PostgreSQL the test can stop and start:
 *   E2E_RESILIENCE_DATABASE_URL, E2E_PG_STOP_CMD, E2E_PG_START_CMD
 * Runs its own production server so it can restart it.
 */
const URL_ = process.env.E2E_RESILIENCE_DATABASE_URL;
const STOP = process.env.E2E_PG_STOP_CMD;
const START = process.env.E2E_PG_START_CMD;
const PORT = 3200;
const BASE = `http://localhost:${PORT}`;

test.skip(!URL_ || !STOP || !START, "Set E2E_RESILIENCE_DATABASE_URL, E2E_PG_STOP_CMD and E2E_PG_START_CMD to run.");
test.use({ baseURL: BASE });

let server: ChildProcess | undefined;
const env = { ...process.env, DATABASE_URL: URL_!, APP_ENV: "test", AUTH_PROVIDER: "local", STORAGE_PROVIDER: "local", DEMO_MODE: "1", INSECURE_COOKIES: "1", DB_AUTO_MIGRATE: "1", DATABASE_CONNECT_TIMEOUT_S: "3" };

async function startServer() {
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}
function stopServer() {
  if (server?.pid) process.kill(-server.pid, "SIGTERM");
  server = undefined;
}

test.beforeAll(async () => {
  execSync("npx tsx src/db/seed.ts", { env, stdio: "ignore" });
  await startServer();
});
function ensureDatabaseUp() {
  try {
    execSync(START!, { stdio: "ignore" });
  } catch {
    // already running
  }
}

test.afterAll(() => {
  stopServer();
  ensureDatabaseUp();
});

test("data persists across an application restart", async ({ browser }) => {
  const title = `Persistência ${Date.now().toString(36)}`;
  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/community");
  await mem.getByRole("button", { name: /Partilhe uma pergunta/ }).click();
  await mem.locator('input[name="title"]').fill(title);
  await mem.locator('textarea[name="body"]').fill("Escrito antes do reinício do servidor.");
  await mem.getByRole("button", { name: "Publicar" }).click();
  await expect(mem.getByText("Publicado.")).toBeVisible();

  stopServer();
  await startServer();

  const again = await loginAs(browser, MEMBER);
  await again.goto("/community");
  await expect(again.getByRole("link", { name: title })).toBeVisible();
});

test("database outage: honest errors, no false confirmations, automatic recovery", async ({ browser }) => {
  const inv = await loginAs(browser, INVESTOR);
  await inv.goto("/community");
  await inv.getByRole("button", { name: /Partilhe uma pergunta/ }).click();
  await inv.locator('input[name="title"]').fill("Durante a falha");
  await inv.locator('textarea[name="body"]').fill("Isto não deve ser guardado.");

  execSync(STOP!, { stdio: "ignore" });
  try {
    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(503);
    expect((await health.json()).checks.database.ok).toBe(false);

    await inv.getByRole("button", { name: "Publicar" }).click();
    await expect(inv.getByText(/temporariamente indisponível|A operação não foi guardada/).first()).toBeVisible({ timeout: 30_000 });
    await expect(inv.getByText("Publicado.")).toHaveCount(0);

    await inv.goto("/dashboard");
    await expect(inv.getByRole("heading", { name: /indisponível/i })).toBeVisible({ timeout: 30_000 });
  } finally {
    ensureDatabaseUp();
  }

  await expect.poll(async () => (await fetch(`${BASE}/api/health`)).status, { timeout: 30_000 }).toBe(200);
  await inv.goto("/community");
  await expect(inv.getByRole("link", { name: "Durante a falha" })).toHaveCount(0);
});
