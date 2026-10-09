import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";
import { databaseUrlFrom, sslFor } from "../lib/supabase-env";

/**
 * One PostgreSQL database, two interchangeable drivers:
 *
 * - `postgres://…` (production, Supabase or any managed/self-hosted Postgres)
 *   via postgres.js. `prepare: false` keeps it compatible with transaction-mode
 *   poolers such as Supavisor/PgBouncer, which serverless hosts require.
 * - `pglite://memory` or `pglite://<dir>` — embedded Postgres (WASM) for tests
 *   and zero-setup local development. Same SQL, same migrations.
 *
 * Nothing outside src/db knows which one is in use.
 */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: DB;
  driver: "postgres" | "pglite";
  close(): Promise<void>;
}

/** DATABASE_URL as pasted from Supabase → Connect, normalised (see lib/supabase-env). */
export function databaseUrl() {
  const url = databaseUrlFrom(process.env);
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return url;
}

export function openDatabase(url: string | undefined = undefined): DbHandle {
  url ??= databaseUrl();
  if (url.startsWith("pglite://")) {
    // Loaded lazily so production bundles never initialise the WASM runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    const target = url.slice("pglite://".length);
    const client = target === "memory" ? new PGlite() : new PGlite(target);
    return { db: drizzlePglite(client, { schema }) as unknown as DB, driver: "pglite", close: () => client.close() };
  }
  const client = postgres(url, {
    prepare: false,
    // postgres.js defaults to no TLS; Supabase endpoints always get it.
    ssl: sslFor(url),
    // Keep pools small on serverless (many instances × pool ≤ pooler limit).
    max: Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 1 : 10)),
    connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_S || 10),
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connection: {
      statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 15000),
      application_name: "no-competition-community",
    },
    onnotice: () => {},
  });
  return { db: drizzlePostgres(client, { schema }) as unknown as DB, driver: "postgres", close: () => client.end({ timeout: 5 }) };
}

// One handle per process (reused across hot reloads in development).
const g = globalThis as unknown as { __nccDb?: DbHandle };
function handle() {
  return (g.__nccDb ??= openDatabase());
}

/** Lazily-opened shared database. Importing this module never connects. */
export const db: DB = new Proxy({} as DB, {
  get(_, prop) {
    const real = handle().db as unknown as Record<PropertyKey, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export function dbHandle() {
  return handle();
}

/** Replace the shared handle (tests, scripts). */
export function setDbHandle(h: DbHandle) {
  g.__nccDb = h;
}

export { schema };
