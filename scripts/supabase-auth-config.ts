/**
 * Configure Supabase Auth for this app through the Management API: custom
 * SMTP (from SMTP_URL / EMAIL_FROM — the same values the app uses), PT-PT
 * email templates with links that work on any device, Site URL, redirect
 * allow-list and the email rate limit.
 *
 *   npm run supabase:auth-config            # dry run: shows what would change (secrets masked)
 *   npm run supabase:auth-config -- --apply # applies it
 *   … -- --no-templates                     # leave the email templates as they are
 *
 * Needs SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens) and the
 * project URL (NEXT_PUBLIC_SUPABASE_URL) to know which project to change.
 * Prints no secret.
 */
import { buildAuthConfig, describePatch, type AuthConfigInput } from "../src/lib/supabase-auth-config";
import { supabaseUrl } from "../src/lib/supabase-env";

async function main() {
  const env = process.env;
  const apply = process.argv.includes("--apply");
  const url = supabaseUrl(env);
  const ref = url?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co$/)?.[1];
  const problems: string[] = [];
  if (!ref) problems.push("NEXT_PUBLIC_SUPABASE_URL: required (https://<ref>.supabase.co) — it decides which project is changed");
  if (env.SUPABASE_PROJECT_REF && ref && env.SUPABASE_PROJECT_REF !== ref) problems.push(`SUPABASE_PROJECT_REF (${env.SUPABASE_PROJECT_REF}) does not match the project URL (${ref})`);
  const token = env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) problems.push("SUPABASE_ACCESS_TOKEN: required (Supabase → Account → Access Tokens)");

  const built = buildAuthConfig(env as AuthConfigInput, { templates: !process.argv.includes("--no-templates") });
  problems.push(...built.problems);
  if (problems.length) {
    console.error(`Not ready:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }

  const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const current = await fetch(api, { headers, signal: AbortSignal.timeout(15_000) });
  if (!current.ok) {
    console.error(`Cannot read the Auth config of ${ref}: HTTP ${current.status} (token without access to this project?)`);
    process.exit(1);
  }
  const now = (await current.json()) as Record<string, unknown>;
  const changes = Object.fromEntries(Object.entries(built.patch).filter(([k, v]) => k === "smtp_pass" || String(now[k] ?? "") !== String(v)));

  console.log(`Project ${ref} — ${Object.keys(changes).length} setting(s) to change:`);
  for (const line of describePatch(changes)) console.log(`  ${line}`);
  if (!apply) {
    console.log("\nDry run. Re-run with --apply to change the project.");
    return;
  }
  const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(changes), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.error(`Update refused: HTTP ${res.status} ${(await res.text()).slice(0, 300).replace(/\w+:\/\/\S+/g, "<url>")}`);
    process.exit(1);
  }
  console.log("\n✓ Applied. Send a test: register with an address outside your Supabase team and check the inbox (and spam).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
