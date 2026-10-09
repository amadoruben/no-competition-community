import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import net from "node:net";
import tls from "node:tls";
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
  const connectTimeoutS = Number(process.env.DATABASE_CONNECT_TIMEOUT_S || 10);
  const client = postgres(url, {
    prepare: false,
    // Supported by postgres.js (README: "socket") but missing from its type definitions.
    ...({ socket: watchedSocket(Number(process.env.DATABASE_SOCKET_TIMEOUT_MS || statementTimeoutMs + 10_000), connectTimeoutS * 1000, tlsModeFor(url)) } as object),
    // TLS is negotiated by the socket factory below (sslmode from the URL;
    // always required for Supabase endpoints), so postgres.js must not add its own.
    ssl: false,
    // postgres.js loads the array type catalogue on every new connection and
    // does not handle that query's failure (an unhandled rejection that
    // terminates a serverless instance). The schema has no array columns.
    fetch_types: false,
    // Keep pools small on serverless (many instances × pool ≤ pooler limit),
    // but above 1: one instance serves concurrent requests (Fluid compute).
    max: Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
    connect_timeout: connectTimeoutS,
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

/** TLS as libpq's sslmode asks for it; null = plain TCP. */
type TlsMode = { prefer: boolean; rejectUnauthorized: boolean } | null;
function tlsModeFor(url: string): TlsMode {
  const q = new URL(url).searchParams;
  const mode = q.get("sslmode") ?? (q.get("sslrootcert") === "system" ? "verify-full" : null) ?? sslFor(url) ?? "disable";
  if (mode === "disable" || mode === "false") return null;
  return { prefer: mode === "prefer" || mode === "allow", rejectUnauthorized: mode === "verify-full" || mode === "verify-ca" };
}

const SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]); // length 8, code 80877103

/**
 * Socket factory for postgres.js that guarantees no query waits forever.
 *
 * statement_timeout bounds a query on the server, but not a connection that
 * died silently (e.g. a pooled socket kept across a serverless instance
 * suspension, or a dropped NAT mapping): the query would wait forever, and
 * every later query queued behind it. Here the socket actually carrying the
 * traffic is destroyed after `idleMs` without any (DB_SOCKET_TIMEOUT, reported
 * as "service unavailable") and the pool opens a fresh connection. A healthy
 * query produces traffic before statement_timeout, so `idleMs` must exceed it.
 *
 * TLS is negotiated here (postgres.js is told ssl: false) because a timer on
 * the TCP socket stops seeing traffic once TLS wraps it.
 *
 * Never rejects: a failure resolves to a socket that errors right after
 * postgres.js has attached its listeners, so its own error, reconnect and
 * pool bookkeeping run exactly as for a refused TCP connection.
 */
function watchedSocket(idleMs: number, connectMs: number, mode: TlsMode) {
  return (o: { host: string[]; port: number[]; path?: string | false }) =>
    new Promise<net.Socket>((resolve) => {
      const host = o.host[0];
      let settled = false;
      const done = (s: net.Socket) => {
        if (settled) return;
        settled = true;
        s.setTimeout(idleMs, () => s.destroy(Object.assign(new Error(`Database connection idle for ${idleMs} ms`), { code: "DB_SOCKET_TIMEOUT" })));
        resolve(s);
      };
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        raw.destroy();
        const dead = new net.Socket();
        setImmediate(() => dead.destroy(err));
        resolve(dead);
      };
      const raw = o.path ? net.connect(o.path) : net.connect({ host, port: o.port[0] });
      raw.setTimeout(connectMs, () => fail(Object.assign(new Error(`Database connection not established within ${connectMs} ms`), { code: "CONNECT_TIMEOUT" })));
      raw.once("error", fail);
      raw.once("connect", () => {
        if (!mode) {
          raw.setTimeout(0);
          raw.off("error", fail);
          return done(raw);
        }
        raw.write(SSL_REQUEST);
        raw.once("data", (b: Buffer) => {
          if (b[0] !== 0x53 /* S */) {
            if (!mode.prefer) return fail(Object.assign(new Error("The database server does not accept TLS"), { code: "ECONNRESET" }));
            raw.setTimeout(0);
            raw.off("error", fail);
            return done(raw);
          }
          const secure = tls.connect({ socket: raw, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: mode.rejectUnauthorized });
          secure.once("error", fail);
          secure.once("secureConnect", () => {
            raw.setTimeout(0);
            raw.off("error", fail);
            secure.off("error", fail);
            done(secure);
          });
        });
      });
    });
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
