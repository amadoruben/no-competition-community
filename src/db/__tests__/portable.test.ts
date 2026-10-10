import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, openDatabase } from "@/db";
import { runMigrations } from "@/db/migrate";
import { exportDatabase, importDatabase, tablesInDependencyOrder, verifyExport } from "@/db/portable";
import { comments, posts } from "@/db/schema";
import { seedDemo } from "@/db/seed-demo";

describe("portable export / restore", () => {
  it("restores a full dataset into a clean database byte-for-byte", async () => {
    await seedDemo(db);
    // A reply whose id sorts before its parent's: the restore must still insert the parent first.
    const [p] = await db.select({ id: posts.id, authorId: posts.authorId }).from(posts).limit(1);
    const parentId = "ffffffff-ffff-4fff-bfff-ffffffffffff";
    await db.insert(comments).values({ id: parentId, postId: p.id, authorId: p.authorId, body: "Pergunta" });
    await db.insert(comments).values({ id: "00000000-0000-4000-8000-000000000001", postId: p.id, authorId: p.authorId, parentId, body: "Resposta" });
    const snapshot = await exportDatabase(db);
    expect(snapshot.tables.users.count).toBeGreaterThan(10);
    expect(snapshot.tables.evaluations.count).toBeGreaterThan(5);
    expect(snapshot.migrations.length).toBeGreaterThanOrEqual(3);
    expect((await verifyExport(db, snapshot)).ok).toBe(true);

    // Restore into a brand-new, independently migrated database.
    const target = openDatabase("pglite://memory");
    await runMigrations(target);
    await importDatabase(target.db, snapshot);
    const report = await verifyExport(target.db, snapshot);
    expect(report.tables.filter((t) => !t.match)).toEqual([]);

    // Relations and integrity survive: every evaluation still points to a submission.
    const orphan = await target.db.execute(sql`select count(*)::int as n from evaluations e left join submissions s on s.id = e.submission_id where s.id is null`);
    const rows = (Array.isArray(orphan) ? orphan : (orphan as { rows: { n: number }[] }).rows) as { n: number }[];
    expect(rows[0].n).toBe(0);
    const reply = await target.db.select({ parentId: comments.parentId }).from(comments).where(sql`${comments.id} = '00000000-0000-4000-8000-000000000001'`);
    expect(reply[0]?.parentId).toBe(parentId);

    // Restoring twice is refused (target not empty).
    await expect(importDatabase(target.db, snapshot)).rejects.toThrow(/not empty/);
    await target.close();
  }, 60_000);

  it("detects tampering and drift", async () => {
    const snapshot = await exportDatabase(db);
    const tampered = structuredClone(snapshot);
    tampered.tables.users.rows[0][1] = "x@evil.test";
    const target = openDatabase("pglite://memory");
    await runMigrations(target);
    await expect(importDatabase(target.db, tampered)).rejects.toThrow(/corrupted/);
    await target.close();

    await db.execute(sql`update challenges set title = title || ' (edit)' where slug = 'energia-acessivel-pme'`);
    const report = await verifyExport(db, snapshot);
    expect(report.ok).toBe(false);
    expect(report.tables.find((t) => t.table === "challenges")?.match).toBe(false);
  }, 60_000);

  it("orders tables so parents precede children", async () => {
    const order = await tablesInDependencyOrder(db);
    expect(order.indexOf("users")).toBeLessThan(order.indexOf("projects"));
    expect(order.indexOf("submissions")).toBeLessThan(order.indexOf("evaluations"));
    expect(order.indexOf("challenges")).toBeLessThan(order.indexOf("results"));
  });
});
