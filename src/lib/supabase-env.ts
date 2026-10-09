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

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!env.NEXT_PUBLIC_SUPABASE_URL) add("error", "NEXT_PUBLIC_SUPABASE_URL is empty (Supabase → Project Settings → API → Project URL).");
  else if (!ref) add("error", "NEXT_PUBLIC_SUPABASE_URL should look like https://<20-character ref>.supabase.co");
  else add("ok", `Project ref from NEXT_PUBLIC_SUPABASE_URL: ${ref}`);

  for (const name of ["AUTH_PROVIDER", "STORAGE_PROVIDER"] as const) {
    if (env[name] !== "supabase") add("warn", `${name} is "${env[name] ?? "local"}"; set it to "supabase" to use the Supabase project.`);
  }

  const run = inspectDbUrl(env.DATABASE_URL);
  if (!env.DATABASE_URL) add("error", "DATABASE_URL is empty (Connect → Transaction pooler, port 6543).");
  else if (!run) add("error", "DATABASE_URL is not a postgres:// URL.");
  else {
    if (run.kind !== "transaction-pooler") add("warn", `DATABASE_URL is a ${run.kind} connection (${run.host}:${run.port}); serverless hosting needs the transaction pooler (port 6543).`);
    else add("ok", `DATABASE_URL: transaction pooler ${run.host}:${run.port}`);
    if (ref && run.ref && run.ref !== ref) add("error", `DATABASE_URL belongs to project ${run.ref}, but NEXT_PUBLIC_SUPABASE_URL is project ${ref}.`);
    if (/\[YOUR-PASSWORD\]|YOUR-PASSWORD/i.test(env.DATABASE_URL)) add("error", "DATABASE_URL still contains the [YOUR-PASSWORD] placeholder.");
  }

  const mig = inspectDbUrl(env.DATABASE_MIGRATION_URL);
  if (!env.DATABASE_MIGRATION_URL) add("warn", "DATABASE_MIGRATION_URL is empty; migrations will use DATABASE_URL (advisory locks need a session connection: Connect → Session pooler, port 5432).");
  else if (!mig) add("error", "DATABASE_MIGRATION_URL is not a postgres:// URL.");
  else {
    if (mig.kind === "transaction-pooler") add("error", "DATABASE_MIGRATION_URL uses the transaction pooler; use the session pooler (port 5432) or the direct connection.");
    else add("ok", `DATABASE_MIGRATION_URL: ${mig.kind} ${mig.host}:${mig.port}`);
    if (ref && mig.ref && mig.ref !== ref) add("error", `DATABASE_MIGRATION_URL belongs to project ${mig.ref}, but NEXT_PUBLIC_SUPABASE_URL is project ${ref}.`);
    if (/YOUR-PASSWORD/i.test(env.DATABASE_MIGRATION_URL)) add("error", "DATABASE_MIGRATION_URL still contains the [YOUR-PASSWORD] placeholder.");
  }

  const pub = inspectKey(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!pub) add("error", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is empty (API Keys → Publishable key).");
  else if (pub.kind === "secret" || pub.kind === "service-role-jwt")
    add("error", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a SECRET key. It would be exposed to browsers: replace it with the publishable key and rotate the secret key.");
  else if (pub.kind === "unknown") add("warn", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a recognised Supabase key format.");
  else {
    add("ok", `Publishable key: ${pub.kind}`);
    if (ref && pub.ref && pub.ref !== ref) add("error", `The publishable key belongs to project ${pub.ref}, not ${ref}.`);
  }

  const sec = inspectKey(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!sec) add(env.STORAGE_PROVIDER === "supabase" ? "error" : "warn", "SUPABASE_SERVICE_ROLE_KEY is empty (API Keys → Secret key). Needed for storage and identity provisioning.");
  else if (sec.kind === "publishable" || sec.kind === "anon-jwt") add("error", "SUPABASE_SERVICE_ROLE_KEY holds a publishable key; it needs the secret (service_role) key.");
  else if (sec.kind === "unknown") add("warn", "SUPABASE_SERVICE_ROLE_KEY is not a recognised Supabase key format.");
  else {
    add("ok", `Secret key: ${sec.kind}`);
    if (ref && sec.ref && sec.ref !== ref) add("error", `The secret key belongs to project ${sec.ref}, not ${ref}.`);
  }

  if (env.APP_URL && !/^https?:\/\//.test(env.APP_URL)) add("error", "APP_URL must start with http:// or https://");
  return { ref, findings: f };
}
