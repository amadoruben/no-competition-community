import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory cookie jar standing in for next/headers in a request.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
}));
const sent: { to: string; text: string }[] = [];
vi.mock("../../mail", () => ({ sendEmail: async (e: { to: string; text: string }) => void sent.push(e) }));

const { LocalAuthProvider, THROTTLE } = await import("../local");
const { SupabaseAuthProvider } = await import("../supabase");
const { AuthError } = await import("../types");

const errKind = async (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof AuthError ? e.kind : String(e)));

describe("LocalAuthProvider", () => {
  const auth = new LocalAuthProvider();
  beforeEach(() => jar.clear());

  it("signs up, keeps a session, and signs out", async () => {
    const { identity } = await auth.signUp("Ana@Example.test", "correct-horse");
    expect(identity.email).toBe("ana@example.test");
    expect((await auth.currentIdentity())?.subject).toBe(identity.subject);
    await auth.signOut();
    expect(await auth.currentIdentity()).toBeNull();
    expect(await errKind(auth.signUp("ana@example.test", "another-pass"))).toBe("exists");
  });

  it("rejects bad credentials and throttles repeated failures", async () => {
    await auth.provisionIdentity("bruno@example.test", "right-password");
    expect(await errKind(auth.signIn("bruno@example.test", "wrong"))).toBe("invalid");
    expect(await errKind(auth.signIn("nobody@example.test", "wrong"))).toBe("invalid");
    for (let i = 1; i < THROTTLE.attempts; i++) await errKind(auth.signIn("bruno@example.test", "wrong"));
    // Even the right password is refused while throttled.
    expect(await errKind(auth.signIn("bruno@example.test", "right-password"))).toBe("throttled");
  });

  it("resets a password with a single-use token and revokes old sessions", async () => {
    const { identity } = await auth.signUp("carla@example.test", "old-password");
    const oldSession = jar.get("ncc_session");
    await auth.requestPasswordReset("carla@example.test", "https://app.test/reset-password");
    await auth.requestPasswordReset("ghost@example.test", "https://app.test/reset-password"); // silent
    expect(sent.filter((m) => m.to === "carla@example.test")).toHaveLength(1);
    expect(sent.some((m) => m.to === "ghost@example.test")).toBe(false);
    const token = new URL(sent.at(-1)!.text.match(/https:\S+/)![0]).searchParams.get("token")!;

    await auth.completePasswordReset({ token, password: "new-password" });
    expect(await errKind(auth.completePasswordReset({ token, password: "again-password" }))).toBe("invalid");
    jar.set("ncc_session", oldSession!);
    expect(await auth.currentIdentity()).toBeNull(); // previous session revoked
    jar.clear();
    expect((await auth.signIn("carla@example.test", "new-password")).subject).toBe(identity.subject);
  });
});

describe("SupabaseAuthProvider (contract against the Supabase Auth HTTP API)", () => {
  const user = { id: "6f1c0f7e-6a1b-4c6c-9a3b-1f2e3d4c5b6a", email: "ana@example.test", aud: "authenticated", role: "authenticated" };
  const session = { access_token: "a.b.c", refresh_token: "r", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const body = JSON.parse(String(init?.body));
      if (body.password === "rate-limited") return json(429, { code: "over_request_rate_limit", msg: "rate limit" });
      return body.password === "good-password" ? json(200, session) : json(400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    }
    if (url.pathname === "/auth/v1/user") return json(200, user);
    if (url.pathname === "/auth/v1/recover") return json(200, {});
    return json(404, { msg: "not mocked" });
  };
  const sb = new SupabaseAuthProvider("https://project.supabase.test", "sb_publishable_test", fakeFetch);
  beforeEach(() => jar.clear());

  it("maps sign-in success to an identity and stores the session in cookies", async () => {
    expect(await sb.signIn("ana@example.test", "good-password")).toEqual({ subject: user.id, email: user.email });
    expect([...jar.keys()].some((k) => k.startsWith("sb-"))).toBe(true);
    expect((await sb.currentIdentity())?.subject).toBe(user.id);
    expect(calls).toContain("GET /auth/v1/user"); // identity is validated server-side, not read from the cookie
  });

  it("maps provider errors to application errors", async () => {
    expect(await errKind(sb.signIn("ana@example.test", "bad"))).toBe("invalid");
    expect(await errKind(sb.signIn("ana@example.test", "rate-limited"))).toBe("throttled");
  });

  it("requests a password reset through the provider", async () => {
    await sb.requestPasswordReset("ana@example.test", "https://app.test/reset-password");
    expect(calls.some((c) => c.startsWith("POST /auth/v1/recover"))).toBe(true);
  });
});
