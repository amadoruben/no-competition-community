/**
 * npm run db:export -- [--out file.json] [--exclude-auth]
 * Writes a portable, checksummed JSON snapshot of the database.
 * Uses DATABASE_MIGRATION_URL (direct connection) when set.
 */
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../src/db";
import { exportDatabase } from "../src/db/portable";

async function main() {
  const args = process.argv.slice(2);
  const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join("backups", `ncc-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const h = openDatabase(process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL);
  const file = await exportDatabase(h.db, { includeAuth: !args.includes("--exclude-auth") });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(file), { mode: 0o600 });
  const total = Object.values(file.tables).reduce((s, t) => s + t.count, 0);
  console.log(`Exported ${Object.keys(file.tables).length} tables, ${total} rows → ${out}`);
  await h.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
