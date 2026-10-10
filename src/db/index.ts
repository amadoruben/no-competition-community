import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";
import * as schema from "./schema";
import { databaseUrlFrom, sslFor } from "../lib/supabase-env";

/**
 * One PostgreSQL database, two interchangeable drivers:
 *
 * - `postgres://…` (production, Supabase or any managed/self-hosted Postgres)
 *   via node-postgres (pg). It runs one query at a time per connection, which
 *   transaction-mode poolers (Supavisor, PgBouncer — required on serverless)
 *   need: postgres.js pipelines concurrent queries on one connection, and
 *   through Supavisor those queries can hang forever or receive another
 *   query's rows (Supabase docs, Postgres.js guide; porsager/postgres#970).
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
  /** Run `fn` on one dedicated connection (session state such as advisory locks holds across its queries). */
  session<T>(fn: (db: DB) => Promise<T>): Promise<T>;
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
    const db = drizzlePglite(client, { schema }) as unknown as DB;
    return { db, driver: "pglite", close: () => client.close(), session: (fn) => fn(db) };
  }
  const statementTimeoutMs = Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 15000);
  const { connectionString, ssl } = pgTarget(url);
  const pool = new pg.Pool({
    connectionString,
    ssl,
    // Keep pools small on serverless (many instances × pool ≤ pooler limit),
    // but above 1: one instance serves concurrent requests (Fluid compute).
    max: Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
    // Bounds both opening a connection and waiting for a free one.
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_S || 10) * 1000,
    idleTimeoutMillis: 10_000,
    maxLifetimeSeconds: 60 * 30,
    // Server-side limit, and a client-side one for when no answer comes back
    // at all (dead connection): the query fails instead of waiting forever,
    // and the pool discards that connection.
    statement_timeout: statementTimeoutMs,
    query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT_MS || statementTimeoutMs + 5_000),
    application_name: "no-competition-community",
    keepAlive: true,
  });
  // An idle connection dropped by the server emits "error" on the pool; without
  // a listener that would terminate the process. The pool replaces it.
  pool.on("error", (e) => console.warn(JSON.stringify({ level: "warn", event: "db.idle_connection_lost", error: e.message })));
  // Fluid compute: release idle connections before the instance is suspended,
  // so no connection is reused after it silently died during the suspension.
  if (process.env.VERCEL) attachDatabasePool(pool);
  return {
    db: drizzlePg(pool, { schema }) as unknown as DB,
    driver: "postgres",
    close: () => pool.end(),
    session: async (fn) => {
      const client = await pool.connect();
      try {
        return await fn(drizzlePg(client, { schema }) as unknown as DB);
      } finally {
        client.release();
      }
    },
  };
}

/**
 * TLS as libpq's sslmode asks for it (always for Supabase endpoints), with
 * libpq's meaning: "require" encrypts without verifying the certificate,
 * "verify-full"/"verify-ca" (or sslrootcert=system) verify it. The SSL
 * parameters are removed from the URL because pg would otherwise apply its
 * own interpretation of them over the `ssl` option.
 */
function pgTarget(url: string): { connectionString: string; ssl: false | { rejectUnauthorized: boolean } } {
  const u = new URL(url);
  const q = u.searchParams;
  const mode = q.get("sslmode") ?? (q.get("sslrootcert") === "system" ? "verify-full" : null) ?? sslFor(url) ?? "disable";
  for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) q.delete(k);
  const ssl = mode === "disable" || mode === "false" ? false : { rejectUnauthorized: mode === "verify-full" || mode === "verify-ca" };
  return { connectionString: u.toString(), ssl };
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
