/**
 * npm run supabase:check [-- --auth-roundtrip]
 *
 * Verifies a Supabase configuration end to end without printing secrets:
 *   1. offline consistency (same project everywhere, right pooler modes, key kinds)
 *   2. database: connects with DATABASE_URL and DATABASE_MIGRATION_URL, checks the
 *      database is empty or this app's (never another product's), lists pending migrations
 *   3. Auth API reachable with the publishable key; whether email confirmation is on
 *   4. Storage: the private bucket exists (else: npm run supabase:bootstrap)
 *   5. --auth-roundtrip: creates a throwaway confirmed user with the secret key, signs in
 *      with the publishable key (the same call the login page makes), then deletes it
 *
 * Read-only except step 5 (opt-in, cleans up after itself). Exit code 1 on any error.
 *
 * --build (Vercel build step): does nothing until AUTH_PROVIDER=supabase and all five
 * Supabase values are set (lists the missing names), then runs every check and fails
 * the build on errors; adds the sign-in round trip unless APP_ENV=production.
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { randomBytes, randomUUID } from "node:crypto";
import { openDatabase } from "../src/db";
import { assertOwnDatabase } from "../src/db/guard";
import { MIGRATIONS_DIR } from "../src/db/migrate";
import {
  analyseSupabaseEnv,
  clean,
  databaseUrlFrom,
  hasPasswordPlaceholder,
  migrationDatabaseUrl,
  publishableKey,
  SECRET_KEY_VAR,
  secretKey,
  supabaseUrl,
  type Finding,
} from "../src/lib/supabase-env";

const results: Finding[] = [];
const mark = { ok: "✓", warn: "!", error: "✗" } as const;
function report(level: Finding["level"], message: string) {
  results.push({ level, message });
  console.log(`  ${mark[level]} ${message}`);
}
const reason = (e: unknown) => {
  // Drizzle wraps driver errors ("Failed query: …"); the useful part is the innermost cause.
  let err = e as { code?: string; message?: string; cause?: unknown };
  while (err?.cause) err = err.cause as typeof err;
  // postgres.js and fetch errors never include the connection string; strip any URL defensively.
  return `${err.code ? `${err.code}: ` : ""}${String(err.message ?? e).replace(/\w+:\/\/\S+/g, "<url>")}`;
};

async function checkDatabase(label: string, url: string | undefined) {
  if (!url) return;
  const h = openDatabase(url);
  try {
    const r = await h.db.execute(sql`select current_setting('server_version') as v, current_user as u`);
    const row = (Array.isArray(r) ? r[0] : (r as unknown as { rows: Record<string, string>[] }).rows[0]) as { v: string; u: string };
    report("ok", `${label}: connected (PostgreSQL ${row.v}, role ${row.u})`);
    return h;
  } catch (e) {
    report("error", `${label}: cannot connect — ${reason(e)}`);
    await h.close().catch(() => {});
  }
}

/** Names of the values still to provide (DATABASE_MIGRATION_URL is derived, never required). */
function missingValues(env: NodeJS.ProcessEnv) {
  const missing: string[] = [];
  if (!clean(env.DATABASE_URL)) missing.push("DATABASE_URL");
  else if (hasPasswordPlaceholder(databaseUrlFrom(env))) missing.push("SUPABASE_DB_PASSWORD");
  if (!supabaseUrl(env)) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey(env)) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!secretKey(env)) missing.push(SECRET_KEY_VAR);
  return missing;
}

async function main() {
  const env = process.env;
  const build = process.argv.includes("--build");
  const roundtrip = process.argv.includes("--auth-roundtrip") || (build && env.APP_ENV !== "production");
  if (build) {
    const missing = missingValues(env);
    if (env.AUTH_PROVIDER !== "supabase" || missing.length) {
      console.warn(`⚠ Supabase check skipped: ${env.AUTH_PROVIDER !== "supabase" ? "AUTH_PROVIDER is not supabase" : `missing ${missing.join(", ")}`}.`);
      return;
    }
  }
  console.log("\n1. Configuration");
  const { ref, findings } = analyseSupabaseEnv(env);
  for (const f of findings) report(f.level, f.message);
  if (findings.some((f) => f.level === "error")) {
    console.log("\nFix the configuration above first.");
    process.exit(1);
  }

  console.log("\n2. Database");
  const runUrl = databaseUrlFrom(env);
  const run = await checkDatabase("DATABASE_URL", runUrl);
  const migUrl = migrationDatabaseUrl(env);
  const mig = migUrl && migUrl !== runUrl ? await checkDatabase("Migration connection (session)", migUrl) : run;
  const h = mig ?? run;
  if (h) {
    try {
      await assertOwnDatabase(h.db, MIGRATIONS_DIR);
      const exists = await h.db.execute(sql`select to_regclass('drizzle.__drizzle_migrations') is not null as e`);
      const has = ((Array.isArray(exists) ? exists[0] : (exists as unknown as { rows: { e: boolean }[] }).rows[0]) as { e: boolean }).e;
      const applied = has ? await h.db.execute(sql`select hash from drizzle.__drizzle_migrations`) : [];
      const appliedSet = new Set((Array.isArray(applied) ? applied : (applied as unknown as { rows: { hash: string }[] }).rows).map((r) => (r as { hash: string }).hash));
      const all = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR });
      const pending = all.filter((m) => !appliedSet.has(m.hash)).length;
      if (pending === 0) report("ok", `Migrations: all ${all.length} applied`);
      else report("warn", `Migrations: ${pending} of ${all.length} pending — run npm run db:migrate (or deploy: the Vercel build applies them)`);
    } catch (e) {
      report("error", reason(e));
    }
  }
  if (run && run !== mig) await run.close();
  await mig?.close();

  console.log("\n3. Auth");
  const url = supabaseUrl(env)!;
  const pub = publishableKey(env)!;
  const secret = secretKey(env);
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: pub }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) report("error", `Auth API answered ${res.status} — is the publishable key from project ${ref}?`);
    else {
      const s = (await res.json()) as { disable_signup?: boolean; mailer_autoconfirm?: boolean; external?: { email?: boolean } };
      report("ok", "Auth API reachable with the publishable key");
      if (s.external?.email === false) report("error", "Email/password sign-in is disabled (Authentication → Sign In / Providers → Email).");
      if (s.disable_signup) report("warn", "New sign-ups are disabled: /register will fail.");
      report(
        "ok",
        s.mailer_autoconfirm
          ? "Email confirmation is OFF: accounts can sign in immediately"
          : "Email confirmation is ON: /register sends an email (default Supabase SMTP only delivers to the organisation's team members)",
      );
    }
  } catch (e) {
    report("error", `Auth API unreachable — ${reason(e)}`);
  }

  console.log("\n4. Storage");
  const bucket = env.STORAGE_BUCKET ?? "ncc-files";
  if (!secret) report("warn", "Skipped (no secret key)");
  else {
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.storage.getBucket(bucket);
    if (data) report(data.public ? "error" : "ok", data.public ? `Bucket "${bucket}" is PUBLIC; it must be private (npm run supabase:bootstrap fixes it)` : `Bucket "${bucket}" exists and is private`);
    else if (error && /not found/i.test(error.message)) report("warn", `Bucket "${bucket}" does not exist yet — npm run supabase:bootstrap (the Vercel build also creates it)`);
    else report("error", `Storage check failed — ${reason(error)} (is the secret key from project ${ref}?)`);

    if (roundtrip) {
      console.log("\n5. Sign-in round trip");
      const email = `ncc-check-${randomUUID().slice(0, 8)}@example.com`;
      const password = randomBytes(18).toString("base64url");
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (!created.data.user) report("error", `Could not create the throwaway user — ${reason(created.error)}`);
      else {
        try {
          const client = createClient(url, pub, { auth: { persistSession: false, autoRefreshToken: false } });
          const { data: signed, error: signErr } = await client.auth.signInWithPassword({ email, password });
          if (signErr || !signed.session) report("error", `Sign-in failed — ${reason(signErr)}`);
          else {
            const { data: me } = await client.auth.getUser(signed.session.access_token);
            report(me.user?.id === created.data.user.id ? "ok" : "error", "Password sign-in with the publishable key returns a valid, verifiable session");
          }
        } finally {
          const { error: delErr } = await admin.auth.admin.deleteUser(created.data.user.id);
          report(delErr ? "warn" : "ok", delErr ? `Delete the throwaway user ${email} manually` : "Throwaway user deleted");
        }
      }
    }
  }

  const errors = results.filter((r) => r.level === "error").length;
  const warnings = results.filter((r) => r.level === "warn").length;
  console.log(`\n${errors ? "✗" : "✓"} ${errors} error(s), ${warnings} warning(s)${ref ? ` · project ${ref}` : ""}\n`);
  process.exit(errors ? 1 : 0);
}

main().catch((e) => {
  console.error(reason(e));
  process.exit(1);
});
