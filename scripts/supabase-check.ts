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
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { randomBytes, randomUUID } from "node:crypto";
import { openDatabase } from "../src/db";
import { assertOwnDatabase } from "../src/db/guard";
import { MIGRATIONS_DIR } from "../src/db/migrate";
import {
  analyseSupabaseEnv,
  databaseUrlFrom,
  databaseUrlSource,
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

/**
 * Sessions that can stall the application: transactions left open and queries
 * waiting on a lock. Reports counts and durations only (no query text).
 */
async function checkSessions(h: { db: Awaited<ReturnType<typeof openDatabase>>["db"] }) {
  try {
    const res = await h.db.execute(sql`
      select coalesce(nullif(application_name, ''), '(unnamed)') as app, coalesce(state, '?') as state, count(*)::int as n,
             coalesce(max(extract(epoch from now() - xact_start)), 0)::int as xact_s,
             count(*) filter (where cardinality(pg_blocking_pids(pid)) > 0)::int as blocked
      from pg_stat_activity
      where datname = current_database() and backend_type = 'client backend' and pid <> pg_backend_pid()
      group by 1, 2 order by 3 desc`);
    const rows = (Array.isArray(res) ? res : (res as unknown as { rows: unknown[] }).rows) as { app: string; state: string; n: number; xact_s: number; blocked: number }[];
    const total = rows.reduce((a, r) => a + r.n, 0);
    report("ok", `Sessions: ${total} other client connection(s)${rows.length ? ` — ${rows.map((r) => `${r.app}/${r.state}×${r.n}`).join(", ")}` : ""}`);
    for (const r of rows) {
      if (r.state.startsWith("idle in transaction") && r.xact_s > 60) report("warn", `${r.n} session(s) of ${r.app} idle in an open transaction for up to ${r.xact_s}s — they hold locks`);
      if (r.state === "active" && r.xact_s > 30) report("warn", `${r.n} session(s) of ${r.app} running for up to ${r.xact_s}s`);
      if (r.blocked) report("warn", `${r.blocked} session(s) of ${r.app} waiting on a lock`);
    }
  } catch (e) {
    report("warn", `Sessions: not visible to this role — ${reason(e)}`);
  }
}

/** Names of the values still to provide (DATABASE_MIGRATION_URL is derived, never required). */
function missingValues(env: NodeJS.ProcessEnv) {
  const missing: string[] = [];
  if (!databaseUrlSource(env)) missing.push("DATABASE_URL");
  else if (hasPasswordPlaceholder(databaseUrlFrom(env))) missing.push("SUPABASE_DB_PASSWORD");
  if (!supabaseUrl(env)) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey(env)) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!secretKey(env)) missing.push(SECRET_KEY_VAR);
  return missing;
}

/** Where Supabase sends a browser for a given link (never follows it). */
async function redirectTarget(link: string): Promise<string | null> {
  const res = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
  return res.headers.get("location");
}
const originOf = (u: string | null) => {
  try {
    return u ? new URL(u).origin : null;
  } catch {
    return null;
  }
};

/**
 * Email links against the real project, without sending email:
 *  - Site URL: an invalid link is sent back to the Site URL (fallback for every link);
 *  - redirect allow-list: whether this deployment's addresses are accepted as redirect targets;
 *  - a real sign-up confirmation link for a throwaway user, followed one hop: it must confirm
 *    the account and land on this deployment's /auth/callback with a session.
 * Prints origins and yes/no only — never tokens.
 */
async function checkEmailLinks(url: string, admin: SupabaseClient) {
  const targets = [...new Set([process.env.APP_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL].filter(Boolean).map((h) => (h!.startsWith("http") ? h! : `https://${h}`)).map((o) => new URL(o).origin))];
  console.log("\n6. Email links");
  const probe = (redirect?: string) => `${url}/auth/v1/verify?type=signup&token=ncc-link-probe${redirect ? `&redirect_to=${encodeURIComponent(redirect)}` : ""}`;
  try {
    const site = originOf(await redirectTarget(probe()));
    report(site ? "ok" : "warn", site ? `Site URL (fallback for email links): ${site}` : "Could not determine the Site URL");
    if (!targets.length) return report("warn", "No deployment address known (APP_URL / VERCEL_BRANCH_URL): redirect checks skipped");
    let primaryAllowed = false;
    for (const [i, origin] of targets.entries()) {
      const landed = originOf(await redirectTarget(probe(`${origin}/auth/callback`)));
      const allowed = landed === origin;
      if (i === 0) primaryAllowed = allowed;
      report(allowed ? "ok" : i === 0 ? "error" : "warn", allowed
        ? `Redirect allowed: ${origin}`
        : `Redirect NOT allowed: ${origin} (Supabase would send users to ${landed ?? "?"}). Add ${origin}/** to Authentication → URL Configuration → Redirect URLs`);
    }
    if (!primaryAllowed) return;

    const email = `ncc-link-${randomUUID().slice(0, 8)}@example.com`;
    const redirectTo = `${targets[0]}/auth/callback`;
    const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email, password: randomBytes(18).toString("base64url"), options: { redirectTo } });
    if (error || !data.properties?.action_link) return report("error", `Could not generate a sign-up link — ${reason(error)}`);
    try {
      const landing = await redirectTarget(data.properties.action_link);
      const ok = !!landing && landing.startsWith(redirectTo) && /access_token=|[?&]code=/.test(landing);
      report(ok ? "ok" : "error", ok
        ? `Sign-up confirmation link confirms the account and returns to ${redirectTo} with a session`
        : `Sign-up confirmation link landed on ${originOf(landing) ?? "?"} without a session`);
      const { data: after } = await admin.auth.admin.getUserById(data.user.id);
      report(after.user?.email_confirmed_at ? "ok" : "error", after.user?.email_confirmed_at ? "Account marked as confirmed" : "Account NOT confirmed after following the link");
    } finally {
      const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
      report(delErr ? "warn" : "ok", delErr ? `Delete the throwaway user ${email} manually` : "Throwaway user deleted");
    }
  } catch (e) {
    report("warn", `Email link checks could not run — ${reason(e)}`);
  }
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
    await checkSessions(h);
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
      await checkEmailLinks(url, admin);
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
