/**
 * Runtime configuration, validated once. Required values depend on the chosen
 * providers so a misconfigured deployment fails fast with a clear message.
 */
import { z } from "zod";
import { databaseUrlFrom, hasPasswordPlaceholder, publishableKey, SECRET_KEY_VAR, secretKey, supabaseUrl } from "@/lib/supabase-env";

const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "preview", "demo", "production"]).default("development"),
    // Required, but checked in superRefine so every missing variable is reported at once.
    DATABASE_URL: z.string().optional(),
    AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    DEMO_MODE: z.enum(["0", "1"]).optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().default("ncc-files"),
    STORAGE_LOCAL_DIR: z.string().default("data/uploads"),
    APP_URL: z.url().optional(),
    /** Comma-separated emails that become the investor (platform owner) once their email is verified. */
    OWNER_EMAILS: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.DATABASE_URL) ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "required" });
    else if (hasPasswordPlaceholder(v.DATABASE_URL))
      ctx.addIssue({ code: "custom", path: ["SUPABASE_DB_PASSWORD"], message: "required: DATABASE_URL contains [YOUR-PASSWORD]" });
    const needsSupabase = v.AUTH_PROVIDER === "supabase" || v.STORAGE_PROVIDER === "supabase";
    if (needsSupabase && !v.NEXT_PUBLIC_SUPABASE_URL) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "required by the Supabase providers" });
    if (v.AUTH_PROVIDER === "supabase" && !v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], message: "required by AUTH_PROVIDER=supabase" });
    if (v.STORAGE_PROVIDER === "supabase" && !v.SUPABASE_SERVICE_ROLE_KEY)
      ctx.addIssue({ code: "custom", path: [SECRET_KEY_VAR], message: "required by STORAGE_PROVIDER=supabase" });
    if (process.env.VERCEL && v.STORAGE_PROVIDER === "local")
      ctx.addIssue({ code: "custom", path: ["STORAGE_PROVIDER"], message: "local storage is not persistent on Vercel; use supabase" });
    if (process.env.VERCEL_ENV === "production" && !process.env.APP_ENV)
      ctx.addIssue({ code: "custom", path: ["APP_ENV"], message: "must be set explicitly on a production deployment" });
    if (process.env.VERCEL && v.DATABASE_URL?.startsWith("pglite://"))
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "embedded PGlite is not persistent on Vercel; use a PostgreSQL URL" });
  });

export type Config = z.infer<typeof schema>;

/**
 * The environment as the app will use it: empty values (`KEY=`) mean "not set",
 * and Supabase values are normalised exactly as the database and auth code do.
 */
function definedEnv() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  return {
    ...env,
    DATABASE_URL: databaseUrlFrom(process.env),
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl(process.env),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey(process.env),
    SUPABASE_SERVICE_ROLE_KEY: secretKey(process.env),
  };
}
let cached: Config | undefined;

/** Problems with the current configuration, as "VARIABLE: reason" (never values). */
export function configIssues(): string[] {
  const r = schema.safeParse(definedEnv());
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

export function config(): Config {
  if (cached) return cached;
  const r = schema.safeParse(definedEnv());
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${lines}\nSee .env.example and docs/OPERATIONS.md.`);
  }
  return (cached = r.data);
}

/**
 * Demo shortcuts (one-click demo login). Off in production unless explicitly
 * enabled; read directly so a misconfigured deployment can still render pages.
 */
export function demoMode() {
  const flag = process.env.DEMO_MODE;
  if (flag === "1" || flag === "0") return flag === "1";
  if (process.env.VERCEL_ENV === "production") return false;
  return (process.env.APP_ENV ?? "development") !== "production";
}

/** Owner emails (lower-case). Read directly: also used where full config may be invalid. */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
