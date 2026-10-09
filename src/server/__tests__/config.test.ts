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
    expect(configIssues().some((i) => i.startsWith("DATABASE_URL"))).toBe(true);
    // Cross-field rules run once the basic shape is valid.
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
});
