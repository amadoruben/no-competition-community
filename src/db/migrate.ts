import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import type { DbHandle } from "./index";

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/** Apply pending versioned migrations (idempotent; tracked in drizzle.__drizzle_migrations). */
export async function runMigrations(h: DbHandle) {
  const config = { migrationsFolder: MIGRATIONS_DIR };
  // Both migrators accept any drizzle pg database; the cast only selects the overload.
  if (h.driver === "pglite") await migratePglite(h.db as never, config);
  else await migratePostgres(h.db as never, config);
}
