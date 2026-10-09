/**
 * Provider-independent logical export/import.
 *
 * A portable JSON snapshot of every application table (plain PostgreSQL
 * types, no provider features), restorable into any empty PostgreSQL after
 * running the migrations. It complements — does not replace — physical
 * backups (pg_dump / provider snapshots); see docs/OPERATIONS.md.
 *
 * Guarantees:
 * - identifiers, timestamps and JSON are preserved exactly;
 * - tables are written/read in foreign-key dependency order;
 * - each table carries a SHA-256 checksum, so an export can be verified
 *   against a live database and a restore can be proven identical.
 *
 * Exports contain personal data and (local auth) password hashes: treat the
 * file as a secret (encrypt at rest, restrict access).
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DB } from "./index";

export const EXPORT_FORMAT = "ncc-export";
export const EXPORT_VERSION = 1;

/** Transient tables that are never exported (sessions, throttling, one-time tokens). */
const TRANSIENT = new Set(["auth_sessions", "auth_attempts", "auth_password_resets"]);

export interface TableDump {
  columns: { name: string; type: string }[];
  rows: unknown[][];
  count: number;
  sha256: string;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  migrations: string[];
  tables: Record<string, TableDump>;
}

type Row = Record<string, unknown>;

async function query<T extends Row>(db: DB, q: ReturnType<typeof sql>): Promise<T[]> {
  const r = await db.execute(q);
  return (Array.isArray(r) ? r : (r as unknown as { rows: T[] }).rows) as T[];
}

/** Public tables in an order where every table comes after the tables it references. */
export async function tablesInDependencyOrder(db: DB): Promise<string[]> {
  const tables = (await query<{ t: string }>(db, sql`select tablename as t from pg_tables where schemaname = 'public' order by tablename`)).map((r) => r.t);
  const edges = await query<{ child: string; parent: string }>(
    db,
    sql`select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
        from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where c.contype = 'f' and n.nspname = 'public'`,
  );
  const strip = (s: string) => s.replace(/^public\./, "").replace(/"/g, "");
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const e of edges) if (strip(e.child) !== strip(e.parent)) deps.get(strip(e.child))?.add(strip(e.parent));
  const out: string[] = [];
  const visiting = new Set<string>();
  const visit = (t: string) => {
    if (out.includes(t)) return;
    if (visiting.has(t)) throw new Error(`Foreign-key cycle involving ${t}`);
    visiting.add(t);
    for (const p of deps.get(t) ?? []) visit(p);
    visiting.delete(t);
    out.push(t);
  };
  tables.forEach(visit);
  return out;
}

async function columnsOf(db: DB, table: string) {
  return query<{ name: string; type: string }>(
    db,
    sql`select column_name as name, data_type as type from information_schema.columns where table_schema = 'public' and table_name = ${table} order by ordinal_position`,
  );
}

async function primaryKey(db: DB, table: string) {
  const rows = await query<{ name: string }>(
    db,
    sql`select a.attname as name from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = ${`public.${table}`}::regclass and i.indisprimary order by array_position(i.indkey, a.attnum)`,
  );
  return rows.map((r) => r.name);
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Normalise a value so the same data always serialises identically, whichever driver read it. */
function normalise(v: unknown, type: string): unknown {
  if (v === null || v === undefined) return null;
  if (type.startsWith("timestamp")) return new Date(v as string | Date).toISOString();
  if (type === "jsonb" || type === "json") return typeof v === "string" ? JSON.parse(v) : v;
  if (type === "double precision" || type === "integer" || type === "bigint" || type === "numeric") return Number(v);
  return v;
}

const checksum = (rows: unknown[][]) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");

async function dumpTable(db: DB, table: string): Promise<TableDump> {
  const columns = await columnsOf(db, table);
  const pk = await primaryKey(db, table);
  const order = (pk.length ? pk : columns.map((c) => c.name)).map(ident).join(", ");
  const list = columns.map((c) => ident(c.name)).join(", ");
  const raw = await query<Row>(db, sql.raw(`select ${list} from public.${ident(table)} order by ${order}`));
  const rows = raw.map((r) => columns.map((c) => normalise(r[c.name], c.type)));
  return { columns, rows, count: rows.length, sha256: checksum(rows) };
}

async function appliedMigrations(db: DB) {
  const rows = await query<{ hash: string }>(db, sql`select hash from drizzle.__drizzle_migrations order by created_at`).catch(() => []);
  return rows.map((r) => r.hash);
}

export async function exportDatabase(db: DB, opts: { includeAuth?: boolean } = {}): Promise<ExportFile> {
  const tables: Record<string, TableDump> = {};
  for (const t of await tablesInDependencyOrder(db)) {
    if (TRANSIENT.has(t)) continue;
    if (opts.includeAuth === false && t.startsWith("auth_")) continue;
    tables[t] = await dumpTable(db, t);
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), migrations: await appliedMigrations(db), tables };
}

export interface VerifyReport {
  ok: boolean;
  tables: { table: string; expected: number; actual: number; match: boolean }[];
}

/** Compare a snapshot with the live database (counts and checksums per table). */
export async function verifyExport(db: DB, file: ExportFile): Promise<VerifyReport> {
  assertFormat(file);
  const tables: VerifyReport["tables"] = [];
  for (const [t, dump] of Object.entries(file.tables)) {
    const live = await dumpTable(db, t);
    tables.push({ table: t, expected: dump.count, actual: live.count, match: live.sha256 === dump.sha256 });
  }
  return { ok: tables.every((t) => t.match), tables };
}

function assertFormat(file: ExportFile) {
  if (file.format !== EXPORT_FORMAT) throw new Error("Not a No Competition export file");
  if (file.version > EXPORT_VERSION) throw new Error(`Export version ${file.version} is newer than this tool (${EXPORT_VERSION})`);
  for (const [t, d] of Object.entries(file.tables)) if (checksum(d.rows) !== d.sha256) throw new Error(`Export file is corrupted (checksum mismatch in ${t})`);
}

/**
 * Restore a snapshot into a database that has the schema migrated and no
 * application data. Runs in one transaction: either everything is restored
 * or nothing is.
 */
export async function importDatabase(db: DB, file: ExportFile) {
  assertFormat(file);
  const order = await tablesInDependencyOrder(db);
  const missing = Object.keys(file.tables).filter((t) => !order.includes(t));
  if (missing.length) throw new Error(`Target schema is missing tables: ${missing.join(", ")}. Run migrations first.`);
  for (const t of Object.keys(file.tables)) {
    const [{ n }] = await query<{ n: number }>(db, sql.raw(`select count(*)::int as n from public.${ident(t)}`));
    if (n > 0) throw new Error(`Target table ${t} is not empty; restore only into an empty database.`);
  }
  await db.transaction(async (tx) => {
    for (const t of order) {
      const dump = file.tables[t];
      if (!dump || dump.rows.length === 0) continue;
      const target = new Set((await columnsOf(tx as unknown as DB, t)).map((c) => c.name));
      const cols = dump.columns.filter((c) => target.has(c.name));
      const idx = cols.map((c) => dump.columns.indexOf(c));
      for (let i = 0; i < dump.rows.length; i += 500) {
        const batch = dump.rows.slice(i, i + 500);
        const values = sql.join(
          batch.map((row) => sql`(${sql.join(idx.map((j, k) => cell(row[j], cols[k].type)), sql`, `)})`),
          sql`, `,
        );
        await tx.execute(sql`insert into ${sql.raw(`public.${ident(t)}`)} (${sql.raw(cols.map((c) => ident(c.name)).join(", "))}) values ${values}`);
      }
    }
  });
}

function cell(v: unknown, type: string) {
  if (v === null) return sql`null`;
  if (type === "jsonb" || type === "json") return sql`${JSON.stringify(v)}::jsonb`;
  if (type.startsWith("timestamp")) return sql`${v as string}::timestamptz`;
  if (type === "uuid") return sql`${v as string}::uuid`;
  return sql`${v}`;
}
