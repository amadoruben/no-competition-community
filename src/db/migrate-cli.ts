/**
 * CLI: apply pending migrations (npm run db:migrate). Uses DATABASE_MIGRATION_URL,
 * or derives the Supabase session-pooler URL from DATABASE_URL (see migrationDatabaseUrl).
 */
import { hasPasswordPlaceholder, migrationDatabaseUrl } from "../lib/supabase-env";
import { openDatabase } from "./index";
import { runMigrations } from "./migrate";

async function main() {
  const url = migrationDatabaseUrl(process.env);
  if (!url) {
    // Lets a deployment without a database (e.g. a first Vercel preview) still
    // build; the app then reports 503 on /api/health until configured.
    if (process.argv.includes("--skip-if-unconfigured")) {
      console.warn("⚠ DATABASE_URL not set: skipping migrations. The app will report itself unconfigured.");
      return;
    }
    throw new Error("Set DATABASE_URL (or DATABASE_MIGRATION_URL).");
  }
  if (hasPasswordPlaceholder(url)) {
    const msg = "DATABASE_URL contains [YOUR-PASSWORD]: set SUPABASE_DB_PASSWORD to the database password.";
    if (process.argv.includes("--skip-if-unconfigured")) return console.warn(`⚠ ${msg} Skipping migrations.`);
    throw new Error(msg);
  }
  const h = openDatabase(url);
  await runMigrations(h);
  console.log("Migrations applied.");
  await h.close();
}

main().catch((e) => {
  // Drizzle wraps driver errors ("Failed query: …"); the cause says what went wrong.
  let err = e as { message?: string; code?: string; cause?: unknown };
  while (err?.cause) err = err.cause as typeof err;
  const message = String(err?.message ?? e).replace(/\w+:\/\/\S+/g, "<url>"); // never echo a connection string
  console.error(`Migrations not applied: ${err?.code ? `${err.code} ` : ""}${message}`);
  process.exit(1);
});
