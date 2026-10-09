import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase, type DbHandle } from "@/db";
import { isInfraUnavailable } from "@/server/infra-errors";

// Needs a real server (the watchdog is a TCP/TLS socket): runs with TEST_DATABASE_URL.
// TLS variants also need TEST_DATABASE_TLS=1 (a server with ssl = on).
const url = process.env.TEST_DATABASE_URL;
const withSsl = (u: string) => `${u}${u.includes("?") ? "&" : "?"}sslmode=require`;
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as Record<string, unknown>[];

describe.runIf(url?.startsWith("postgres"))("database connection watchdog", () => {
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

  const variants = [["plain TCP", url!] as const, ...(process.env.TEST_DATABASE_TLS === "1" ? [["TLS", withSsl(url!)] as const] : [])];

  for (const [name, target] of variants) {
    it(`${name}: fails a query whose connection goes silent, then recovers with a fresh connection`, async () => {
      const db = open(target, { DATABASE_SOCKET_TIMEOUT_MS: "500", DATABASE_POOL_MAX: "1" }).db;
      const started = Date.now();
      // pg_sleep sends nothing for 3 s: indistinguishable from a dead socket.
      const err = await db.execute(sql`select pg_sleep(3)`).then(() => null, (e) => e);
      expect(err).toBeTruthy();
      expect(isInfraUnavailable(err)).toBe(true);
      expect(Date.now() - started).toBeLessThan(2_500);
      // The single pooled connection was replaced, so the next query is not stuck behind it.
      expect(rows(await db.execute(sql`select 1 as one`))[0]).toEqual({ one: 1 });
    });
  }

  it.runIf(process.env.TEST_DATABASE_TLS === "1")("sslmode=require really uses TLS (and no sslmode does not)", async () => {
    const tlsDb = open(withSsl(url!)).db;
    expect(rows(await tlsDb.execute(sql`select ssl from pg_stat_ssl where pid = pg_backend_pid()`))[0]).toEqual({ ssl: true });
    await h!.close();
    const plainDb = open(url!).db;
    expect(rows(await plainDb.execute(sql`select ssl from pg_stat_ssl where pid = pg_backend_pid()`))[0]).toEqual({ ssl: false });
  });

  it("a refused connection fails fast, every time, without leaking pool slots", async () => {
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
});
