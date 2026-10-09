import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase, type DbHandle } from "@/db";
import { isInfraUnavailable } from "@/server/infra-errors";

// Needs a real server: runs with TEST_DATABASE_URL. TLS checks also need
// TEST_DATABASE_TLS=1 (a server with ssl = on).
const url = process.env.TEST_DATABASE_URL;
const tlsServer = process.env.TEST_DATABASE_TLS === "1";
const withParam = (u: string, p: string) => `${u}${u.includes("?") ? "&" : "?"}${p}`;
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as Record<string, unknown>[];

describe.runIf(url?.startsWith("postgres"))("PostgreSQL driver", () => {
  let h: DbHandle | undefined;
  afterEach(async () => {
    vi.unstubAllEnvs();
    await h?.close();
    h = undefined;
  });
  const open = (u: string, env: Record<string, string> = {}) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return (h = openDatabase(u));
  };

  it("concurrent queries beyond the pool size each get their own result (no pipelining)", async () => {
    // The production failure: Promise.all over more queries than connections.
    const db = open(url!, { DATABASE_POOL_MAX: "1" }).db;
    const values = Array.from({ length: 12 }, (_, i) => i * 7);
    const results = await Promise.all(values.map((v) => db.execute(sql`select ${v}::int as v, pg_backend_pid() as pid`)));
    expect(results.map((r) => rows(r)[0].v)).toEqual(values);
  });

  for (const [name, target] of [["plain TCP", url!], ...(tlsServer ? [["TLS", withParam(url!, "sslmode=require")]] : [])] as const) {
    it(`${name}: a query with no answer fails on the client, then the pool recovers`, async () => {
      // pg_sleep is a query that answers nothing for 3 s, like a dead connection.
      const db = open(target, { DATABASE_QUERY_TIMEOUT_MS: "500", DATABASE_STATEMENT_TIMEOUT_MS: "10000", DATABASE_POOL_MAX: "1" }).db;
      const started = Date.now();
      const err = await db.execute(sql`select pg_sleep(3)`).then(() => null, (e) => e);
      expect(isInfraUnavailable(err)).toBe(true);
      expect(Date.now() - started).toBeLessThan(2_000);
      expect(rows(await db.execute(sql`select 1 as one`))[0]).toEqual({ one: 1 });
    });
  }

  it("the server-side statement timeout applies", async () => {
    const db = open(url!, { DATABASE_STATEMENT_TIMEOUT_MS: "300", DATABASE_QUERY_TIMEOUT_MS: "5000" }).db;
    const err = await db.execute(sql`select pg_sleep(2)`).then(() => null, (e) => e);
    expect(isInfraUnavailable(err)).toBe(true); // 57014
  });

  it.runIf(tlsServer)("sslmode=require really uses TLS, and no sslmode does not", async () => {
    const tlsDb = open(withParam(url!, "sslmode=require")).db;
    expect(rows(await tlsDb.execute(sql`select ssl from pg_stat_ssl where pid = pg_backend_pid()`))[0]).toEqual({ ssl: true });
    await h!.close();
    const plainDb = open(url!).db;
    expect(rows(await plainDb.execute(sql`select ssl from pg_stat_ssl where pid = pg_backend_pid()`))[0]).toEqual({ ssl: false });
  });

  it("a refused connection fails fast, every time, without exhausting the pool", async () => {
    const u = new URL(url!);
    u.port = "1"; // nothing listens there
    const db = open(u.toString(), { DATABASE_POOL_MAX: "1" }).db;
    for (let i = 0; i < 3; i++) {
      const started = Date.now();
      const err = await db.execute(sql`select 1`).then(() => null, (e) => e);
      expect(isInfraUnavailable(err)).toBe(true);
      expect(Date.now() - started).toBeLessThan(5_000);
    }
  });

  it("session() keeps one connection, so advisory locks are released", async () => {
    const handle = open(url!, { DATABASE_POOL_MAX: "4" });
    const pids = await handle.session(async (db) => {
      const a = rows(await db.execute(sql`select pg_backend_pid() as p`))[0].p;
      await db.execute(sql`select pg_advisory_lock(424242)`);
      const b = rows(await db.execute(sql`select pg_backend_pid() as p`))[0].p;
      await db.execute(sql`select pg_advisory_unlock(424242)`);
      return [a, b];
    });
    expect(pids[0]).toBe(pids[1]);
    const held = rows(await handle.db.execute(sql`select count(*)::int as n from pg_locks where locktype = 'advisory' and objid = 424242`))[0].n;
    expect(held).toBe(0);
  });
});
