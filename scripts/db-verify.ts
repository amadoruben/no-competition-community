/**
 * npm run db:verify -- <file.json>
 * Checks that the live database matches a snapshot (row counts + checksums).
 * Use after a restore, or to prove an export is complete right after taking it.
 */
import fs from "node:fs";
import { openDatabase } from "../src/db";
import { verifyExport, type ExportFile } from "../src/db/portable";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run db:verify -- <export.json>");
  const h = openDatabase(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL);
  const report = await verifyExport(h.db, JSON.parse(fs.readFileSync(file, "utf8")) as ExportFile);
  for (const t of report.tables) console.log(`${t.match ? "ok  " : "DIFF"} ${t.table.padEnd(24)} live ${t.actual} / export ${t.expected}`);
  await h.close();
  if (!report.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
