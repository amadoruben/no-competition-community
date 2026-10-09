import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface HealthReport {
  status: "ok" | "degraded";
  version: string;
  checks: { database: { ok: boolean; latencyMs?: number; error?: string; migrations?: number } };
}

/** Bounded-time readiness check. Never throws; never leaks connection details. */
export async function healthReport(timeoutMs = 3000): Promise<HealthReport> {
  const started = Date.now();
  let database: HealthReport["checks"]["database"];
  try {
    const probe = (async () => {
      await db.execute(sql`select 1`);
      const r = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`).catch(() => null);
      const rows = r ? ((Array.isArray(r) ? r : (r as { rows: { n: number }[] }).rows) as { n: number }[]) : [];
      return rows[0]?.n;
    })();
    const migrations = await Promise.race([
      probe,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    database = { ok: true, latencyMs: Date.now() - started, migrations };
  } catch (e) {
    database = { ok: false, error: e instanceof Error && e.message === "timeout" ? "timeout" : "unreachable" };
  }
  return {
    status: database.ok ? "ok" : "degraded",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.APP_VERSION ?? "dev",
    checks: { database },
  };
}
