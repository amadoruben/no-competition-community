/**
 * npm run db:import -- <file.json>
 * Restores a snapshot into an EMPTY database: applies migrations, inserts all
 * rows in one transaction, then verifies every table checksum.
 */
import fs from "node:fs";
import { openDatabase } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { importDatabase, verifyExport, type ExportFile } from "../src/db/portable";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run db:import -- <export.json>");
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as ExportFile;
  const h = openDatabase(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL);
  await runMigrations(h);
  await importDatabase(h.db, data);
  const report = await verifyExport(h.db, data);
  for (const t of report.tables) console.log(`${t.match ? "ok  " : "FAIL"} ${t.table.padEnd(24)} ${t.actual}/${t.expected}`);
  await h.close();
  if (!report.ok) throw new Error("Restore verification failed");
  console.log("Restore complete and verified.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
