import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { assertOwnDatabase } from "./guard";
import type { DbHandle } from "./index";

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");
const LOCK_KEY = 772001; // arbitrary, constant: serialises concurrent migrators

/** Content hash of the repository's newest migration (what PRODUCTION_APPROVED_MIGRATION is compared with). */
export function latestMigrationHash(folder = MIGRATIONS_DIR): string | undefined {
  try {
    return readMigrationFiles({ migrationsFolder: folder }).at(-1)?.hash;
  } catch {
    return undefined;
  }
}

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
  // Lock, migrations and unlock on one connection: a session lock taken on one
  // pooled connection and released on another would never be released.
  await h.session(async (db) => {
    await db.execute(sql`select pg_advisory_lock(${LOCK_KEY})`);
    try {
      await assertOwnDatabase(db, MIGRATIONS_DIR);
      await migratePostgres(db as never, config);
    } finally {
      await db.execute(sql`select pg_advisory_unlock(${LOCK_KEY})`);
    }
  });
}
