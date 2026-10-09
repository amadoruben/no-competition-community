import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import net from "node:net";
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
  const statementTimeoutMs = Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 15000);
  const client = postgres(url, {
    prepare: false,
    // Supported by postgres.js (README: "socket") but missing from its type definitions.
    ...({ socket: watchedSocket(Number(process.env.DATABASE_SOCKET_TIMEOUT_MS || statementTimeoutMs + 10_000)) } as object),
    // postgres.js defaults to no TLS; Supabase endpoints always get it. Only set
    // when defined: an explicit `ssl: undefined` would override ?sslmode= in the URL.
    ...(sslFor(url) ? { ssl: sslFor(url) } : {}),
    // Keep pools small on serverless (many instances × pool ≤ pooler limit),
    // but above 1: one instance serves concurrent requests (Fluid compute).
    max: Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
    connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_S || 10),
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connection: {
      statement_timeout: statementTimeoutMs,
      application_name: "no-competition-community",
    },
    onnotice: () => {},
  });
  return { db: drizzlePostgres(client, { schema }) as unknown as DB, driver: "postgres", close: () => client.end({ timeout: 5 }) };
}

/**
 * TCP socket that is destroyed after `idleMs` without any traffic.
 *
 * statement_timeout bounds a query on the server, but not a connection that
 * died silently (e.g. a pooled socket kept across a serverless instance
 * suspension, or a dropped NAT mapping): the query would wait forever, and
 * every later query queued behind it. With this watchdog such a query fails
 * with DB_SOCKET_TIMEOUT (reported as "service unavailable") and the pool
 * opens a fresh connection. A healthy query always produces traffic before
 * statement_timeout, so `idleMs` must exceed it.
 */
function watchedSocket(idleMs: number) {
  // Returned before it connects (writes are buffered): postgres.js then sees
  // connection errors and closes on this socket and runs its normal error,
  // reconnect and pool bookkeeping. connect_timeout still applies.
  return (o: { host: string[]; port: number[]; path?: string | false }) => {
    const s = o.path ? net.connect(o.path) : net.connect({ host: o.host[0], port: o.port[0] });
    Object.assign(s, { host: o.host[0], port: o.port[0] }); // TLS SNI uses socket.host
    s.setTimeout(idleMs, () => s.destroy(Object.assign(new Error(`Database connection idle for ${idleMs} ms`), { code: "DB_SOCKET_TIMEOUT" })));
    return s;
  };
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
