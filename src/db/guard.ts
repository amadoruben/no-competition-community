import { getTableName, is, sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgTable } from "drizzle-orm/pg-core";
import type { DB } from "./index";
import * as schema from "./schema";

/** Tables this application owns in the public schema. */
export const OWN_TABLES: ReadonlySet<string> = new Set(
  (Object.values(schema) as unknown[]).filter((v): v is PgTable => is(v, PgTable)).map((t) => getTableName(t)),
);

export class ForeignDatabaseError extends Error {
  constructor(
    readonly foreignTables: string[],
    readonly foreignMigrations: number,
    readonly unrecordedTables: string[] = [],
  ) {
    const parts = [];
    if (foreignTables.length) {
      const shown = foreignTables.slice(0, 8).join(", ");
      parts.push(`${foreignTables.length} table(s) that are not part of this application (${shown}${foreignTables.length > 8 ? ", …" : ""})`);
    }
    if (foreignMigrations) parts.push(`${foreignMigrations} migration(s) in drizzle.__drizzle_migrations that are not from this repository`);
    if (unrecordedTables.length)
      parts.push(`tables named like this application's (${unrecordedTables.slice(0, 5).join(", ")}) that were not created by its migrations`);
    super(
      `Refusing to touch this database: it contains ${parts.join(" and ")}. ` +
        "It probably belongs to another product. Point DATABASE_URL / DATABASE_MIGRATION_URL at the No Competition Community project.",
    );
    this.name = "ForeignDatabaseError";
  }
}

async function rows<T>(db: DB, q: ReturnType<typeof sql>): Promise<T[]> {
  const r = await db.execute(q);
  return (Array.isArray(r) ? r : (r as unknown as { rows: T[] }).rows) as T[];
}

/**
 * Before writing anything (migrations, seed, import), make sure the target is
 * either empty or already this application's database. Migration 0001 enables
 * RLS on every public table and 0000 creates generic names such as "users": run
 * against another product's database, they would break it.
 */
export async function assertOwnDatabase(db: DB, migrationsFolder: string) {
  const tables = (await rows<{ t: string }>(db, sql`select tablename as t from pg_tables where schemaname = 'public'`)).map((r) => r.t);
  const foreignTables = tables.filter((t) => !OWN_TABLES.has(t)).sort();

  let foreignMigrations = 0;
  let oursApplied = 0;
  const [{ exists }] = await rows<{ exists: boolean }>(db, sql`select to_regclass('drizzle.__drizzle_migrations') is not null as exists`);
  if (exists) {
    const ours = new Set(readMigrationFiles({ migrationsFolder }).map((m) => m.hash));
    const applied = await rows<{ hash: string }>(db, sql`select hash from drizzle.__drizzle_migrations`);
    foreignMigrations = applied.filter((r) => !ours.has(r.hash)).length;
    oursApplied = applied.length - foreignMigrations;
  }
  // Same-named tables ("users" is common) only count as ours if our migrations created them.
  const unrecordedTables = oursApplied === 0 ? tables.filter((t) => OWN_TABLES.has(t)).sort() : [];

  if (foreignTables.length || foreignMigrations || unrecordedTables.length) throw new ForeignDatabaseError(foreignTables, foreignMigrations, unrecordedTables);
}
