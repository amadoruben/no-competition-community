/**
 * Runtime configuration, validated once. Required values depend on the chosen
 * providers so a misconfigured deployment fails fast with a clear message.
 */
import { z } from "zod";

const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "preview", "demo", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    DEMO_MODE: z.enum(["0", "1"]).optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().default("ncc-files"),
    STORAGE_LOCAL_DIR: z.string().default("data/uploads"),
    APP_URL: z.url().optional(),
  })
  .superRefine((v, ctx) => {
    const needsSupabase = v.AUTH_PROVIDER === "supabase" || v.STORAGE_PROVIDER === "supabase";
    if (needsSupabase && !v.NEXT_PUBLIC_SUPABASE_URL) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "required by the Supabase providers" });
    if (v.AUTH_PROVIDER === "supabase" && !v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], message: "required by AUTH_PROVIDER=supabase" });
    if (v.STORAGE_PROVIDER === "supabase" && !v.SUPABASE_SERVICE_ROLE_KEY)
      ctx.addIssue({ code: "custom", path: ["SUPABASE_SERVICE_ROLE_KEY"], message: "required by STORAGE_PROVIDER=supabase" });
    if (process.env.VERCEL && v.STORAGE_PROVIDER === "local")
      ctx.addIssue({ code: "custom", path: ["STORAGE_PROVIDER"], message: "local storage is not persistent on Vercel; use supabase" });
    if (process.env.VERCEL_ENV === "production" && !process.env.APP_ENV)
      ctx.addIssue({ code: "custom", path: ["APP_ENV"], message: "must be set explicitly on a production deployment" });
    if (process.env.VERCEL && v.DATABASE_URL.startsWith("pglite://"))
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "embedded PGlite is not persistent on Vercel; use a PostgreSQL URL" });
  });

export type Config = z.infer<typeof schema>;
let cached: Config | undefined;

/** Problems with the current configuration, as "VARIABLE: reason" (never values). */
export function configIssues(): string[] {
  const r = schema.safeParse(process.env);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

export function config(): Config {
  if (cached) return cached;
  const r = schema.safeParse(process.env);
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
