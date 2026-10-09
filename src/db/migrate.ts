import { sql } from "drizzle-orm";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { assertOwnDatabase } from "./guard";
import type { DbHandle } from "./index";

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");
const LOCK_KEY = 772001; // arbitrary, constant: serialises concurrent migrators

/**
 * Apply pending versioned migrations (idempotent; tracked in
 * drizzle.__drizzle_migrations). On PostgreSQL a session advisory lock makes
 * concurrent starts (several instances, a deploy step) safe. Use a direct or
 * session-mode connection: advisory locks do not hold across a
 * transaction-mode pooler.
 *
 * Refuses to run against a database that belongs to another application
 * (see guard.ts).
 */
export async function runMigrations(h: DbHandle) {
  const config = { migrationsFolder: MIGRATIONS_DIR };
  if (h.driver === "pglite") {
    await assertOwnDatabase(h.db, MIGRATIONS_DIR);
    return migratePglite(h.db as never, config);
  }
  await h.db.execute(sql`select pg_advisory_lock(${LOCK_KEY})`);
  try {
    await assertOwnDatabase(h.db, MIGRATIONS_DIR);
    await migratePostgres(h.db as never, config);
  } finally {
    await h.db.execute(sql`select pg_advisory_unlock(${LOCK_KEY})`);
  }
}
