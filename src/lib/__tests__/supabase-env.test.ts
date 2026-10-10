import { describe, expect, it } from "vitest";
import { analyseSupabaseEnv, databaseUrlFrom, previewTargetsProduction, PRODUCTION_SUPABASE_REF_DEFAULT, inspectDbUrl, inspectKey, migrationDatabaseUrl, secretKey, sslFor, supabaseUrl } from "../supabase-env";

// Fictitious refs and keys: shaped like Supabase's, valid nowhere.
const A = "aaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbb";
const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const good = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${A}.supabase.co`,
  DATABASE_URL: `postgresql://postgres.${A}:pw-secret-1@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
  DATABASE_MIGRATION_URL: `postgresql://postgres.${A}:pw-secret-1@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_key-secret-2",
  AUTH_PROVIDER: "supabase",
  STORAGE_PROVIDER: "supabase",
};
const errors = (env: Record<string, string | undefined>) => analyseSupabaseEnv(env).findings.filter((f) => f.level === "error").map((f) => f.message);

describe("supabase env analysis", () => {
  it("accepts a consistent configuration and never echoes secrets", () => {
    const { ref, findings } = analyseSupabaseEnv(good);
    expect(ref).toBe(A);
    expect(errors(good)).toEqual([]);
    const text = JSON.stringify(findings);
    expect(text).not.toContain("pw-secret-1");
    expect(text).not.toContain("key-secret-2");
  });

  it("refuses a Preview deployment that points at the Production project", () => {
    expect(errors({ ...good, VERCEL_ENV: "preview", PRODUCTION_SUPABASE_REF: A }).join()).toContain("points at the Production Supabase project");
    expect(errors({ ...good, VERCEL_ENV: "preview", PRODUCTION_SUPABASE_REF: B })).toEqual([]);
    // Production itself and unconfigured deployments are not affected.
    expect(errors({ ...good, VERCEL_ENV: "production", PRODUCTION_SUPABASE_REF: A })).toEqual([]);
    expect(errors({ ...good, VERCEL_ENV: "preview" })).toEqual([]);
  });

  it("blocks a Preview from the Production project even without PRODUCTION_SUPABASE_REF, through any of its URLs", () => {
    const P = PRODUCTION_SUPABASE_REF_DEFAULT;
    const prodEverywhere = { ...good, NEXT_PUBLIC_SUPABASE_URL: `https://${P}.supabase.co`, DATABASE_URL: good.DATABASE_URL.replace(A, P), DATABASE_MIGRATION_URL: good.DATABASE_MIGRATION_URL.replace(A, P) };
    expect(previewTargetsProduction({ ...prodEverywhere, VERCEL_ENV: "preview" })).toContain("Nothing was migrated");
    // Only the migration URL pointing at Production is enough to refuse.
    expect(previewTargetsProduction({ ...good, VERCEL_ENV: "preview", DATABASE_MIGRATION_URL: good.DATABASE_MIGRATION_URL.replace(A, P) })).not.toBeNull();
    // The integration's POSTGRES_URL (no DATABASE_URL) is caught too.
    expect(previewTargetsProduction({ VERCEL_ENV: "preview", POSTGRES_URL: good.DATABASE_URL.replace(A, P) })).not.toBeNull();
    // Production, local runs and a Preview with its own project are never blocked.
    expect(previewTargetsProduction({ ...prodEverywhere, VERCEL_ENV: "production" })).toBeNull();
    expect(previewTargetsProduction(prodEverywhere)).toBeNull();
    expect(previewTargetsProduction({ ...good, VERCEL_ENV: "preview" })).toBeNull();
  });

  it("catches a database URL from another project", () => {
    expect(errors({ ...good, DATABASE_URL: good.DATABASE_URL.replace(A, B) }).join()).toContain(`belongs to project ${B}`);
  });

  it("catches legacy JWT keys from another project", () => {
    expect(errors({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt({ role: "anon", ref: B }) }).join()).toContain(`project ${B}`);
    expect(errors({ ...good, SUPABASE_SERVICE_ROLE_KEY: jwt({ role: "service_role", ref: B }) }).join()).toContain(`project ${B}`);
  });

  it("flags a secret key placed in the public variable", () => {
    expect(errors({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_oops" }).join()).toContain("SECRET");
    expect(errors({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt({ role: "service_role", ref: A }) }).join()).toContain("SECRET");
  });

  it("flags swapped pooler modes and the password placeholder", () => {
    expect(errors({ ...good, DATABASE_MIGRATION_URL: good.DATABASE_URL }).join()).toContain("session pooler");
    expect(errors({ ...good, DATABASE_URL: good.DATABASE_URL.replace("pw-secret-1", "[YOUR-PASSWORD]") }).join()).toContain("SUPABASE_DB_PASSWORD");
  });

  it("parses direct and pooler URLs", () => {
    expect(inspectDbUrl(`postgresql://postgres:x@db.${A}.supabase.co:5432/postgres`)).toMatchObject({ ref: A, kind: "direct" });
    expect(inspectDbUrl(good.DATABASE_URL)).toMatchObject({ ref: A, kind: "transaction-pooler" });
    expect(inspectKey("nonsense")?.kind).toBe("unknown");
  });

  it("derives the session-pooler URL for migrations from a transaction-pooler DATABASE_URL", () => {
    const withoutMig = { ...good, DATABASE_MIGRATION_URL: undefined };
    expect(migrationDatabaseUrl(withoutMig)).toBe(good.DATABASE_MIGRATION_URL);
    expect(errors(withoutMig)).toEqual([]);
    expect(JSON.stringify(analyseSupabaseEnv(withoutMig).findings)).toContain("(derived)");
    // An explicit value wins; non-Supabase URLs are used unchanged.
    expect(migrationDatabaseUrl({ ...good, DATABASE_MIGRATION_URL: "postgres://x@db.example:5432/y" })).toBe("postgres://x@db.example:5432/y");
    expect(migrationDatabaseUrl({ DATABASE_URL: "postgres://u@localhost:5432/ncc" })).toBe("postgres://u@localhost:5432/ncc");
    expect(migrationDatabaseUrl({})).toBeUndefined();
  });

  describe("values pasted exactly as the Supabase dashboard shows them", () => {
    const template = `postgresql://postgres.${A}:[YOUR-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`;

    it("inserts SUPABASE_DB_PASSWORD into [YOUR-PASSWORD], URL-encoding any character", () => {
      const password = "p@ss/w:rd#1?$&";
      const env = { ...good, DATABASE_URL: template, DATABASE_MIGRATION_URL: undefined, SUPABASE_DB_PASSWORD: password };
      const url = new URL(databaseUrlFrom(env)!);
      expect(decodeURIComponent(url.password)).toBe(password);
      expect(url.username).toBe(`postgres.${A}`);
      expect(new URL(migrationDatabaseUrl(env)!).port).toBe("5432");
      expect(errors(env)).toEqual([]);
      expect(JSON.stringify(analyseSupabaseEnv(env).findings)).not.toContain("p@ss");
    });

    it("asks for SUPABASE_DB_PASSWORD when the placeholder is left in", () => {
      expect(errors({ ...good, DATABASE_URL: template, DATABASE_MIGRATION_URL: undefined }).join()).toContain("SUPABASE_DB_PASSWORD");
    });

    it("accepts the session-pooler string and switches the app to transaction mode", () => {
      const session = template.replace(":6543", ":5432");
      const env = { ...good, DATABASE_URL: session, DATABASE_MIGRATION_URL: undefined, SUPABASE_DB_PASSWORD: "x" };
      expect(new URL(databaseUrlFrom(env)!).port).toBe("6543");
      expect(new URL(migrationDatabaseUrl(env)!).port).toBe("5432");
    });

    it("drops parameters the driver would reject and trims quotes, spaces and line breaks", () => {
      const env = { DATABASE_URL: `  "${template}?pgbouncer=true&connection_limit=1&sslmode=require"\n`, SUPABASE_DB_PASSWORD: " pw \n" };
      const url = new URL(databaseUrlFrom(env)!);
      expect([...url.searchParams.keys()]).toEqual(["sslmode"]);
      expect(url.password).toBe("pw");
    });

    it("reduces the project URL to its origin and accepts the dashboard's key name", () => {
      expect(supabaseUrl({ NEXT_PUBLIC_SUPABASE_URL: ` https://${A}.supabase.co/rest/v1/ ` })).toBe(`https://${A}.supabase.co`);
      expect(secretKey({ SUPABASE_SECRET_KEY: " sb_secret_new " })).toBe("sb_secret_new");
      expect(secretKey({ SUPABASE_SERVICE_ROLE_KEY: "sb_secret_old" })).toBe("sb_secret_old");
    });

    it("requires TLS for Supabase hosts only, unless the URL sets sslmode", () => {
      expect(sslFor(good.DATABASE_URL)).toBe("require");
      expect(sslFor(`postgresql://postgres:x@db.${A}.supabase.co:5432/postgres`)).toBe("require");
      expect(sslFor(`${good.DATABASE_URL}?sslmode=disable`)).toBeUndefined();
      expect(sslFor("postgres://postgres@localhost:5432/ncc")).toBeUndefined();
    });

    it("warns that the direct connection cannot be reached from Vercel", () => {
      const direct = `postgresql://postgres:pw@db.${A}.supabase.co:5432/postgres`;
      const text = JSON.stringify(analyseSupabaseEnv({ ...good, DATABASE_URL: direct, DATABASE_MIGRATION_URL: undefined }).findings);
      expect(text).toContain("Transaction pooler");
    });
  });

  describe("variables written by the Supabase–Vercel integration", () => {
    const integration = {
      AUTH_PROVIDER: "supabase",
      STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: `https://${A}.supabase.co`,
      POSTGRES_URL: `postgres://postgres.${A}:pw-int@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_int",
      SUPABASE_SECRET_KEY: "sb_secret_int",
    };

    it("work on their own, with the integration's extra URL parameters dropped", () => {
      const url = new URL(databaseUrlFrom(integration)!);
      expect([...url.searchParams.keys()]).toEqual(["sslmode"]);
      expect(new URL(migrationDatabaseUrl(integration)!).port).toBe("5432");
      expect(supabaseUrl(integration)).toBe(`https://${A}.supabase.co`);
      expect(errors(integration)).toEqual([]);
      expect(JSON.stringify(analyseSupabaseEnv(integration).findings)).toContain("POSTGRES_URL");
    });

    it("POSTGRES_URL fills in for a DATABASE_URL still waiting for its password", () => {
      const env = { ...integration, DATABASE_URL: `postgresql://postgres.${A}:[YOUR-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres` };
      expect(new URL(databaseUrlFrom(env)!).password).toBe("pw-int");
      // A complete DATABASE_URL still wins.
      expect(new URL(databaseUrlFrom({ ...env, SUPABASE_DB_PASSWORD: "own" })!).password).toBe("own");
    });

    it("a POSTGRES_URL from another project is caught", () => {
      expect(errors({ ...integration, POSTGRES_URL: integration.POSTGRES_URL.replaceAll(A, B) }).join()).toContain(`belongs to project ${B}`);
    });
  });
});

