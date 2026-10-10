/**
 * CLI: load the demonstration dataset.
 *   npm run db:seed                 wipe application tables and reseed
 *   npm run db:seed -- --if-empty   seed only when there are no users
 * Refuses to run against an environment marked APP_ENV=production.
 */
import { count } from "drizzle-orm";
import { dbHandle } from "./index";
import { runMigrations } from "./migrate";
import { users } from "./schema";
import { DEMO_PASSWORD } from "./seed-data";
import { seedDemo } from "./seed-demo";

async function main() {
  if (process.env.APP_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    console.error("Refusing to seed demo data into APP_ENV=production. Set ALLOW_DEMO_SEED=1 to override deliberately.");
    process.exit(1);
  }
  const h = dbHandle();
  await runMigrations(h);
  if (process.argv.includes("--if-empty")) {
    const [{ n }] = await h.db.select({ n: count() }).from(users);
    if (n > 0) {
      console.log("Database already has data; skipping seed.");
      return h.close();
    }
  }
  await seedDemo(h.db);
  console.log(`Seeded demo data. Demo password for every account: ${DEMO_PASSWORD}`);
  console.log("  investidor@demo.ncc (investidora) · avaliador@demo.ncc (avaliadora) · membro@demo.ncc (membro)");
  await h.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
