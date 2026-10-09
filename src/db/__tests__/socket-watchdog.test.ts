import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { openDatabase, type DbHandle } from "@/db";
import { isInfraUnavailable } from "@/server/infra-errors";

// Needs a real server (the watchdog is a TCP socket): runs with TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;

describe.runIf(url?.startsWith("postgres"))("database connection watchdog", () => {
  let h: DbHandle;
  afterAll(() => h?.close());

  it("fails a query whose connection goes silent, then recovers with a fresh connection", async () => {
    vi.stubEnv("DATABASE_SOCKET_TIMEOUT_MS", "500");
    vi.stubEnv("DATABASE_POOL_MAX", "1");
    h = openDatabase(url);
    vi.unstubAllEnvs();
    // pg_sleep sends nothing for 2 s: indistinguishable from a dead socket.
    const err = await h.db.execute(sql`select pg_sleep(2)`).then(() => null, (e) => e);
    expect(err).toBeTruthy();
    expect(isInfraUnavailable(err)).toBe(true);
    // The single pooled connection was replaced, so the next query is not stuck behind it.
    const r = await h.db.execute(sql`select 1 as one`);
    expect((Array.isArray(r) ? r[0] : (r as unknown as { rows: { one: number }[] }).rows[0])).toEqual({ one: 1 });
  });
});
