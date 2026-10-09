/** CLI: apply pending migrations (npm run db:migrate). Uses DATABASE_MIGRATION_URL when set (direct connection). */
import { openDatabase } from "./index";
import { runMigrations } from "./migrate";

async function main() {
  const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DATABASE_MIGRATION_URL).");
  const h = openDatabase(url);
  await runMigrations(h);
  console.log("Migrations applied.");
  await h.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
