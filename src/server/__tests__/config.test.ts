import { afterEach, describe, expect, it, vi } from "vitest";
import { configIssues, demoMode } from "../config";

afterEach(() => vi.unstubAllEnvs());

describe("demoMode", () => {
  it("is on by default outside production and off when APP_ENV=production", () => {
    vi.stubEnv("DEMO_MODE", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("APP_ENV", "preview");
    expect(demoMode()).toBe(true);
    vi.stubEnv("APP_ENV", "production");
    expect(demoMode()).toBe(false);
  });

  it("is off on a Vercel production deployment even if APP_ENV is missing", () => {
    vi.stubEnv("DEMO_MODE", undefined);
    vi.stubEnv("APP_ENV", undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(demoMode()).toBe(false);
  });

  it("follows an explicit DEMO_MODE flag", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DEMO_MODE", "1");
    expect(demoMode()).toBe(true);
  });
});

describe("configIssues", () => {
  it("names missing variables without echoing values", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_ENV", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-value-should-not-leak");
    vi.stubEnv("AUTH_PROVIDER", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
    // Every problem is reported at once, so an operator fixes them in one pass.
    const all = configIssues().map((i) => i.split(":")[0]);
    expect(all).toEqual(expect.arrayContaining(["DATABASE_URL", "APP_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]));
    vi.stubEnv("DATABASE_URL", "postgres://user:secret-value-should-not-leak@db.example:6543/postgres");
    const issues = configIssues();
    expect(issues.some((i) => i.startsWith("APP_ENV"))).toBe(true);
    expect(issues.join(" ")).not.toContain("secret-value");
  });

  it("treats empty values (KEY= in .env files) as unset, not invalid", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("DATABASE_URL", "postgres://localhost/x");
    vi.stubEnv("AUTH_PROVIDER", "local");
    vi.stubEnv("STORAGE_PROVIDER", "local");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("APP_URL", "");
    expect(configIssues()).toEqual([]);
    vi.stubEnv("AUTH_PROVIDER", "supabase");
    expect(configIssues()).toContain("NEXT_PUBLIC_SUPABASE_URL: required by the Supabase providers");
  });

  it("names exactly what is missing for a dashboard paste", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("APP_ENV", "preview");
    vi.stubEnv("AUTH_PROVIDER", "supabase");
    vi.stubEnv("STORAGE_PROVIDER", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://aaaaaaaaaaaaaaaaaaaa.supabase.co/rest/v1/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    vi.stubEnv("SUPABASE_DB_PASSWORD", undefined);
    vi.stubEnv("DATABASE_URL", "postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:[YOUR-PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:6543/postgres");
    expect(configIssues().map((i) => i.split(":")[0]).sort()).toEqual(["SUPABASE_DB_PASSWORD", "SUPABASE_SECRET_KEY"]);
    vi.stubEnv("SUPABASE_DB_PASSWORD", "pw");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    expect(configIssues()).toEqual([]);
  });
});

