/**
 * Test database: embedded Postgres (PGlite) by default, or a real server via
 * TEST_DATABASE_URL (must contain "test" in the database name; it is reset).
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll } from "vitest";
import { openDatabase, setDbHandle, type DbHandle } from "@/db";
import { runMigrations } from "@/db/migrate";

let handle: DbHandle;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL ?? "pglite://memory";
  if (url.startsWith("postgres") && !/test/i.test(new URL(url).pathname)) throw new Error("TEST_DATABASE_URL must point to a *test* database");
  handle = openDatabase(url);
  if (handle.driver === "postgres") {
    await handle.db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`);
  }
  await runMigrations(handle);
  setDbHandle(handle);
}, 60_000);

afterAll(async () => {
  await handle?.close();
});
