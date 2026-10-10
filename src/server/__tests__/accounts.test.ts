import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, users, type User } from "@/db/schema";
import { deleteAccount, resolveUser } from "../accounts";
import { createPost } from "../community";
import { DomainError } from "../errors";
import { createProject } from "../projects";

const mk = async (handle: string, extra: Partial<User> = {}) =>
  (await db.insert(users).values({ email: `${handle}@t.test`, authSubject: `s-${handle}`, name: handle, handle, role: "member", ...extra }).returning())[0];
const exists = async (id: string) => (await db.select({ id: users.id }).from(users).where(eq(users.id, id))).length === 1;
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof DomainError ? e.code : `raw:${e}`));

describe("account deletion (GDPR art. 17)", () => {
  it("removes the profile, its posts and the identity", async () => {
    const u = await mk("leaver");
    await createPost(u, { kind: "question", title: "Pergunta de teste", body: "Corpo da pergunta de teste." });
    const deleted: string[] = [];
    await deleteAccount(u, " LEAVER@t.test ", async (s) => void deleted.push(s));
    expect(await exists(u.id)).toBe(false);
    expect(await db.select().from(posts).where(eq(posts.authorId, u.id))).toHaveLength(0);
    expect(deleted).toEqual(["s-leaver"]);
  });

  it("does not hold a transaction while the provider works (the local provider uses the database)", async () => {
    const u = await mk("local-provider");
    // With one connection (PGlite, or a pool of 1) a query issued here from inside an open transaction would deadlock.
    await deleteAccount(u, u.email, async () => void (await db.select({ id: users.id }).from(users).limit(1)));
    expect(await exists(u.id)).toBe(false);
  }, 10_000);

  it("requires the account's email as confirmation", async () => {
    const u = await mk("careful");
    expect(await code(deleteAccount(u, "someone@else.test", async () => {}))).toBe("invalid");
    expect(await exists(u.id)).toBe(true);
  });

  it("refuses demo accounts", async () => {
    const u = await mk("demo-x", { isDemo: true });
    expect(await code(deleteAccount(u, u.email, async () => {}))).toBe("forbidden");
    expect(await exists(u.id)).toBe(true);
  });

  it("refuses accounts that own work others depend on, and keeps the identity", async () => {
    const u = await mk("founder");
    await createProject(u, { name: "Fundada", tagline: "Projecto com dono de teste", category: "Teste", stage: "mvp", logoHue: 1, websiteUrl: "", demoUrl: "", repoUrl: "" });
    let called = false;
    expect(await code(deleteAccount(u, u.email, async () => void (called = true)))).toBe("conflict");
    expect(await exists(u.id)).toBe(true);
    expect(called).toBe(false);
  });

  it("keeps the profile when the identity cannot be deleted", async () => {
    const u = await mk("stuck");
    await expect(deleteAccount(u, u.email, async () => { throw new Error("provider down"); })).rejects.toThrow("provider down");
    expect(await exists(u.id)).toBe(true);
  });
});

describe("profile after email confirmation", () => {
  it("uses the name kept by the provider at sign-up", async () => {
    const u = await resolveUser({ subject: "s-confirmed", email: "confirmed@t.test", name: "Joana Confirmada" });
    expect(u.name).toBe("Joana Confirmada");
  });
});
