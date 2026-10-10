import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { openDatabase } from "@/db";
import { ForeignDatabaseError, OWN_TABLES } from "@/db/guard";
import { runMigrations } from "@/db/migrate";

const tableCount = async (h: ReturnType<typeof openDatabase>) => {
  const r = await h.db.execute(sql`select count(*)::int as n from pg_tables where schemaname = 'public'`);
  return ((Array.isArray(r) ? r : (r as unknown as { rows: { n: number }[] }).rows)[0] as { n: number }).n;
};

describe("migrations never touch another product's database", () => {
  it("knows its own tables", () => {
    expect(OWN_TABLES.has("users")).toBe(true);
    expect(OWN_TABLES.has("challenges")).toBe(true);
    expect(OWN_TABLES.has("trainers")).toBe(false);
  });

  it("migrates an empty database and is idempotent on its own database", async () => {
    const h = openDatabase("pglite://memory");
    await runMigrations(h);
    await runMigrations(h);
    expect(await tableCount(h)).toBe(OWN_TABLES.size);
    await h.close();
  });

  it("refuses a database holding another application's tables, and changes nothing", async () => {
    const h = openDatabase("pglite://memory");
    await h.db.execute(sql`create table trainers (id text primary key)`);
    const err = await runMigrations(h).catch((e) => e);
    expect(err).toBeInstanceOf(ForeignDatabaseError);
    expect((err as ForeignDatabaseError).foreignTables).toEqual(["trainers"]);
    expect(await tableCount(h)).toBe(1);
    const rls = await h.db.execute(sql`select bool_or(rowsecurity) as on from pg_tables where schemaname = 'public'`);
    expect(((Array.isArray(rls) ? rls : (rls as unknown as { rows: { on: boolean }[] }).rows)[0] as { on: boolean }).on).toBe(false);
    await h.close();
  });

  it("refuses same-named tables that this application's migrations did not create", async () => {
    const h = openDatabase("pglite://memory");
    await h.db.execute(sql`create table users (id int, email text, role text)`);
    const err = await runMigrations(h).catch((e) => e);
    expect(err).toBeInstanceOf(ForeignDatabaseError);
    expect((err as ForeignDatabaseError).unrecordedTables).toEqual(["users"]);
    expect(await tableCount(h)).toBe(1);
    await h.close();
  });

  it("refuses a database whose migration journal is from another repository", async () => {
    const h = openDatabase("pglite://memory");
    await h.db.execute(sql`create schema drizzle`);
    await h.db.execute(sql`create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`);
    await h.db.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('not-ours', 1)`);
    const err = await runMigrations(h).catch((e) => e);
    expect(err).toBeInstanceOf(ForeignDatabaseError);
    expect((err as ForeignDatabaseError).foreignMigrations).toBe(1);
    expect(await tableCount(h)).toBe(0);
    await h.close();
  });
});
