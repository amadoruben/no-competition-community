/**
 * npm run user:role -- <email> <member|evaluator|investor>
 *
 * Operator-only role change, e.g. to make the first real investor after they
 * register at /register. Requires database credentials (DATABASE_URL); there is
 * no web endpoint for this. Refuses to run against another product's database.
 */
import { ROLES } from "../src/db/schema";
import { dbHandle } from "../src/db";
import { assertOwnDatabase } from "../src/db/guard";
import { MIGRATIONS_DIR } from "../src/db/migrate";
import { setUserRole } from "../src/server/accounts";

async function main() {
  const [email, role] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!email || !ROLES.includes(role as (typeof ROLES)[number])) {
    console.error(`Usage: npm run user:role -- <email> <${ROLES.join("|")}>`);
    process.exit(2);
  }
  const h = dbHandle();
  try {
    await assertOwnDatabase(h.db, MIGRATIONS_DIR);
    const u = await setUserRole(email, role as (typeof ROLES)[number]);
    console.log(`${u.email} is now ${u.role}.`);
  } finally {
    await h.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
