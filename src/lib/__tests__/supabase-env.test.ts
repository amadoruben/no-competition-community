import { describe, expect, it } from "vitest";
import { analyseSupabaseEnv, inspectDbUrl, inspectKey } from "../supabase-env";

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
    expect(errors({ ...good, DATABASE_URL: good.DATABASE_URL.replace("pw-secret-1", "[YOUR-PASSWORD]") }).join()).toContain("placeholder");
  });

  it("parses direct and pooler URLs", () => {
    expect(inspectDbUrl(`postgresql://postgres:x@db.${A}.supabase.co:5432/postgres`)).toMatchObject({ ref: A, kind: "direct" });
    expect(inspectDbUrl(good.DATABASE_URL)).toMatchObject({ ref: A, kind: "transaction-pooler" });
    expect(inspectKey("nonsense")?.kind).toBe("unknown");
  });
});
