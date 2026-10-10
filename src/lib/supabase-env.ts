/**
 * Offline consistency checks for a Supabase configuration. Pure: no network,
 * and findings never contain secret values (only project refs, hosts, ports and
 * key kinds, none of which grant access).
 */
export type Finding = { level: "ok" | "warn" | "error"; message: string };
type Env = Record<string, string | undefined>;

export function projectRefFromUrl(url: string | undefined): string | null {
  const m = url?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/);
  return m ? m[1] : null;
}

export interface DbUrlInfo {
  ref: string | null;
  host: string;
  port: number;
  kind: "transaction-pooler" | "session-pooler" | "direct" | "other";
}

export function inspectDbUrl(raw: string | undefined): DbUrlInfo | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return null;
  const port = Number(u.port || 5432);
  const user = decodeURIComponent(u.username);
  const pooler = u.hostname.endsWith(".pooler.supabase.com");
  const direct = u.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  const ref = user.match(/^postgres\.([a-z0-9]{20})$/)?.[1] ?? direct?.[1] ?? null;
  const kind = pooler ? (port === 6543 ? "transaction-pooler" : "session-pooler") : direct ? (port === 6543 ? "transaction-pooler" : "direct") : "other";
  return { ref, host: u.hostname, port, kind };
}

/** Values pasted into dashboards often carry spaces, line breaks or quotes. */
export function clean(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  let s = v.trim();
  if (s.length > 1 && (s[0] === '"' || s[0] === "'") && s.at(-1) === s[0]) s = s.slice(1, -1).trim();
  return s === "" ? undefined : s;
}

/** Project URL reduced to its origin: "https://<ref>.supabase.co/rest/v1/" → "https://<ref>.supabase.co". */
// Names written by the Supabase–Vercel integration are accepted as fallbacks, so its
// variables can be used as they are, without copying values into our own names.

export function supabaseUrl(env: Env): string | undefined {
  const raw = clean(env.NEXT_PUBLIC_SUPABASE_URL) ?? clean(env.SUPABASE_URL);
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}

export const publishableKey = (env: Env) =>
  clean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? clean(env.SUPABASE_PUBLISHABLE_KEY) ?? clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? clean(env.SUPABASE_ANON_KEY);
/** The dashboard calls it "Secret key"; SUPABASE_SERVICE_ROLE_KEY is the older name, still accepted. */
export const secretKey = (env: Env) => clean(env.SUPABASE_SECRET_KEY) ?? clean(env.SUPABASE_SERVICE_ROLE_KEY);
export const SECRET_KEY_VAR = "SUPABASE_SECRET_KEY";

const PASSWORD_PLACEHOLDER = /\[YOUR[-_]PASSWORD\]|%5BYOUR[-_]PASSWORD%5D/i;
export const hasPasswordPlaceholder = (url: string | undefined) => !!url && PASSWORD_PLACEHOLDER.test(url);

// Connection-string parameters we keep; anything else (e.g. Prisma's "pgbouncer=true"
// from the Connect dialog) is dropped rather than risk being sent to the server as a setting.
const DRIVER_PARAMS = new Set(["sslmode", "sslrootcert", "application_name", "options", "target_session_attrs"]);

/**
 * A connection string exactly as copied from Supabase → Connect, made usable:
 * [YOUR-PASSWORD] is replaced by SUPABASE_DB_PASSWORD (URL-encoded, so any
 * character works) and parameters the driver does not understand are dropped.
 */
function normaliseDbUrl(raw: string | undefined, password: string | undefined): string | undefined {
  let s = clean(raw);
  if (!s) return undefined;
  if (password && hasPasswordPlaceholder(s)) s = s.replace(PASSWORD_PLACEHOLDER, encodeURIComponent(password));
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return s;
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return s;
  for (const k of [...u.searchParams.keys()]) if (!DRIVER_PARAMS.has(k)) u.searchParams.delete(k);
  return u.toString();
}

function withPort(url: string, port: string) {
  const u = new URL(url);
  u.port = port;
  return u.toString();
}

const isSharedPooler = (url: string | undefined) => !!url && inspectDbUrl(url)?.host.endsWith(".pooler.supabase.com") === true;

/**
 * Runtime connection. Any Supabase pooler string works: a session-pooler string
 * (port 5432) is switched to transaction mode (6543, same host and user), which
 * serverless functions need.
 */
/**
 * Where the database connection comes from: DATABASE_URL when it is usable, otherwise
 * the integration's POSTGRES_URL (a complete transaction-pooler string).
 */
export function databaseUrlSource(env: Env): { name: "DATABASE_URL" | "POSTGRES_URL"; raw: string } | undefined {
  const own = clean(env.DATABASE_URL);
  const integration = clean(env.POSTGRES_URL);
  if (own && !(hasPasswordPlaceholder(own) && !clean(env.SUPABASE_DB_PASSWORD))) return { name: "DATABASE_URL", raw: own };
  if (integration) return { name: "POSTGRES_URL", raw: integration };
  return own ? { name: "DATABASE_URL", raw: own } : undefined;
}

export function databaseUrlFrom(env: Env): string | undefined {
  const url = normaliseDbUrl(databaseUrlSource(env)?.raw, clean(env.SUPABASE_DB_PASSWORD));
  return url && isSharedPooler(url) && inspectDbUrl(url)?.port === 5432 ? withPort(url, "6543") : url;
}

/**
 * Migration connection (needs a session: advisory locks). An explicit
 * DATABASE_MIGRATION_URL wins; otherwise the shared pooler's session mode on the
 * same host and user (port 5432), as documented by Supabase. Anything else is used as is.
 */
export function migrationDatabaseUrl(env: Env): string | undefined {
  const explicit = normaliseDbUrl(env.DATABASE_MIGRATION_URL, clean(env.SUPABASE_DB_PASSWORD));
  if (explicit) return explicit;
  const runtime = databaseUrlFrom(env);
  return runtime && isSharedPooler(runtime) ? withPort(runtime, "5432") : runtime;
}

/** Supabase accepts TLS on every endpoint; require it unless the URL says otherwise. */
export function sslFor(url: string): "require" | undefined {
  try {
    const u = new URL(url);
    if (u.searchParams.has("sslmode")) return undefined;
    return /\.supabase\.(co|com)$/.test(u.hostname) ? "require" : undefined;
  } catch {
    return undefined;
  }
}

type KeyInfo = { kind: "publishable" | "secret" | "anon-jwt" | "service-role-jwt" | "unknown"; ref: string | null };

export function inspectKey(key: string | undefined): KeyInfo | null {
  if (!key) return null;
  if (key.startsWith("sb_publishable_")) return { kind: "publishable", ref: null };
  if (key.startsWith("sb_secret_")) return { kind: "secret", ref: null };
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { role?: string; ref?: string };
      if (payload.role === "anon") return { kind: "anon-jwt", ref: payload.ref ?? null };
      if (payload.role === "service_role") return { kind: "service-role-jwt", ref: payload.ref ?? null };
    } catch {
      // fall through
    }
  }
  return { kind: "unknown", ref: null };
}

export function analyseSupabaseEnv(env: Env): { ref: string | null; findings: Finding[] } {
  const f: Finding[] = [];
  const add = (level: Finding["level"], message: string) => f.push({ level, message });

  const projectUrl = supabaseUrl(env);
  const ref = projectRefFromUrl(projectUrl);
  if (!projectUrl) add("error", "NEXT_PUBLIC_SUPABASE_URL is empty (Supabase → Project Settings → API Keys → Project URL).");
  else if (!ref) add("error", "NEXT_PUBLIC_SUPABASE_URL should look like https://<20-character ref>.supabase.co");
  else add("ok", `Project ref from NEXT_PUBLIC_SUPABASE_URL: ${ref}`);

  // Preview and Production must not share a database. PRODUCTION_SUPABASE_REF names
  // the Production project; a Preview build pointing at it fails instead of writing
  // test data into real data.
  const prodRef = clean(env.PRODUCTION_SUPABASE_REF);
  if (prodRef && ref && env.VERCEL_ENV === "preview") {
    if (ref === prodRef) add("error", `This Preview deployment uses the Production Supabase project (${ref}). Give Preview its own project: docs/PREVIEW-DATABASE.md.`);
    else add("ok", `Preview uses its own Supabase project (${ref}), not Production (${prodRef})`);
  }

  for (const name of ["AUTH_PROVIDER", "STORAGE_PROVIDER"] as const) {
    if (env[name] !== "supabase") add("warn", `${name} is "${env[name] ?? "local"}"; set it to "supabase" to use the Supabase project.`);
  }

  const source = databaseUrlSource(env);
  const pasted = source?.raw;
  const runtimeUrl = databaseUrlFrom(env);
  const run = inspectDbUrl(runtimeUrl);
  if (!pasted) add("error", "DATABASE_URL is empty (Supabase → Connect → copy the connection string as shown), and there is no POSTGRES_URL from the Supabase–Vercel integration.");
  else if (hasPasswordPlaceholder(runtimeUrl)) add("error", "DATABASE_URL contains [YOUR-PASSWORD]: add SUPABASE_DB_PASSWORD with the database password (it is inserted automatically).");
  else if (!run) add("error", "DATABASE_URL is not a postgres:// connection string.");
  else {
    if (source?.name === "POSTGRES_URL") add("ok", "Database connection taken from POSTGRES_URL (Supabase–Vercel integration)");
    if (hasPasswordPlaceholder(pasted)) add("ok", "Database password taken from SUPABASE_DB_PASSWORD");
    if (inspectDbUrl(normaliseDbUrl(pasted, undefined))?.kind === "session-pooler") add("ok", "Session-pooler string switched to transaction mode (port 6543) for the app");
    if (run.kind === "direct")
      add("warn", `DATABASE_URL is the direct connection (${run.host}); it is IPv6-only and unreachable from Vercel. Copy the "Transaction pooler" string instead.`);
    else if (run.kind === "other") add("ok", `DATABASE_URL: ${run.host}:${run.port}`);
    else add("ok", `DATABASE_URL: transaction pooler ${run.host}:${run.port}${sslFor(runtimeUrl!) ? " (TLS required)" : ""}`);
    if (ref && run.ref && run.ref !== ref) add("error", `DATABASE_URL belongs to project ${run.ref}, but NEXT_PUBLIC_SUPABASE_URL is project ${ref}.`);
  }

  const migUrl = migrationDatabaseUrl(env);
  const mig = inspectDbUrl(migUrl);
  if (clean(env.DATABASE_MIGRATION_URL)) {
    if (hasPasswordPlaceholder(migUrl)) add("error", "DATABASE_MIGRATION_URL contains [YOUR-PASSWORD]: add SUPABASE_DB_PASSWORD.");
    else if (!mig) add("error", "DATABASE_MIGRATION_URL is not a postgres:// connection string.");
    else if (mig.kind === "transaction-pooler") add("error", "DATABASE_MIGRATION_URL uses the transaction pooler; leave it empty (it is derived) or use the session pooler.");
    else add("ok", `DATABASE_MIGRATION_URL: ${mig.kind} ${mig.host}:${mig.port}`);
    if (ref && mig?.ref && mig.ref !== ref) add("error", `DATABASE_MIGRATION_URL belongs to project ${mig.ref}, but NEXT_PUBLIC_SUPABASE_URL is project ${ref}.`);
  } else if (mig && migUrl !== runtimeUrl) add("ok", `Migrations use the session pooler ${mig.host}:${mig.port} (derived)`);
  else if (run) add("warn", "Migrations will use DATABASE_URL itself (not a Supabase pooler string, so no session connection could be derived).");

  const pub = inspectKey(publishableKey(env));
  if (!pub) add("error", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is empty (API Keys → Publishable key).");
  else if (pub.kind === "secret" || pub.kind === "service-role-jwt")
    add("error", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a SECRET key. It would be exposed to browsers: replace it with the publishable key and rotate the secret key.");
  else if (pub.kind === "unknown") add("warn", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a recognised Supabase key format.");
  else {
    add("ok", `Publishable key: ${pub.kind}`);
    if (ref && pub.ref && pub.ref !== ref) add("error", `The publishable key belongs to project ${pub.ref}, not ${ref}.`);
  }

  const sec = inspectKey(secretKey(env));
  if (!sec) add(env.STORAGE_PROVIDER === "supabase" ? "error" : "warn", `${SECRET_KEY_VAR} is empty (API Keys → Secret keys). Needed for storage and identity provisioning.`);
  else if (sec.kind === "publishable" || sec.kind === "anon-jwt") add("error", `${SECRET_KEY_VAR} holds a publishable key; it needs the secret key.`);
  else if (sec.kind === "unknown") add("warn", `${SECRET_KEY_VAR} is not a recognised Supabase key format.`);
  else {
    add("ok", `Secret key: ${sec.kind}`);
    if (ref && sec.ref && sec.ref !== ref) add("error", `The secret key belongs to project ${sec.ref}, not ${ref}.`);
  }

  if (env.APP_URL && !/^https?:\/\//.test(env.APP_URL)) add("error", "APP_URL must start with http:// or https://");
  return { ref, findings: f };
}
