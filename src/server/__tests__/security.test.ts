/**
 * Permission matrix for the community features: who may post, moderate,
 * link content and change their own account. Complements flow.test.ts
 * (challenges, evaluation confidentiality) and videos.test.ts (exclusive videos).
 */
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { challenges, users, type User } from "@/db/schema";
import { addComment, createPost, deletePost, getPost, setPinned } from "../community";
import { DomainError } from "../errors";
import { updateProfile } from "../members";
import { optionalUrl } from "../validation";

const mk = async (handle: string, role: User["role"] = "member") =>
  (await db.insert(users).values({ email: `${handle}@s.test`, authSubject: `s-${handle}`, name: handle, handle, role }).returning())[0];
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof DomainError ? e.code : `raw:${e}`));
const post = (title: string, extra: Record<string, unknown> = {}) => ({ kind: "discussion", title, body: "Texto da publicação.", ...extra });

describe("links shown to other people", () => {
  it("accept only web addresses", () => {
    for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<b>x</b>", "vbscript:x", "file:///etc/passwd", "mailto:a@b.pt"])
      expect(optionalUrl.safeParse(bad).success, bad).toBe(false);
    expect(optionalUrl.parse("https://nocompetition.pt")).toBe("https://nocompetition.pt");
    expect(optionalUrl.parse("")).toBeNull();
  });

  it("are enforced on profiles", async () => {
    const m = await mk("sec-links");
    expect(await code(updateProfile(m, { name: "Sec Links", websiteUrl: "javascript:alert(document.cookie)", linkedinUrl: "", githubUrl: "" }))).toBe("invalid");
  });
});

describe("posts", () => {
  it("only the team publishes official announcements", async () => {
    const m = await mk("sec-m1");
    const admin = await mk("sec-admin", "investor");
    expect(await code(createPost(m, post("Anúncio falso", { kind: "announcement" })))).toBe("forbidden");
    const a = await createPost(admin, post("Bem-vindos", { kind: "announcement" }));
    expect(a.pinned).toBe(true);
  });

  it("authors remove their own posts, other members cannot, the admin moderates any", async () => {
    const author = await mk("sec-author");
    const other = await mk("sec-other");
    const admin = await mk("sec-admin2", "investor");
    const p1 = await createPost(author, post("Publicação do autor"));
    await addComment(other, p1.id, "Comentário de outro membro.");
    expect(await code(deletePost(other, p1.id))).toBe("forbidden");
    expect(await code(setPinned(other, p1.id, true))).toBe("forbidden");
    await deletePost(author, p1.id);
    expect(await code(getPost(author, p1.id))).toBe("not_found");

    const p2 = await createPost(author, post("Para moderar"));
    await setPinned(admin, p2.id, true);
    await deletePost(admin, p2.id);
    expect(await code(getPost(admin, p2.id))).toBe("not_found");
  });

  it("members cannot reveal a draft challenge by linking it", async () => {
    const m = await mk("sec-m2");
    const admin = await mk("sec-admin3", "investor");
    const [draft] = await db
      .insert(challenges)
      .values({
        slug: "sec-rascunho",
        title: "Desafio secreto em rascunho",
        tagline: "t",
        description: "d",
        category: "c",
        status: "draft",
        startsAt: new Date(),
        submissionDeadline: new Date(Date.now() + 864e5),
        resultsDate: new Date(Date.now() + 2 * 864e5),
        createdById: admin.id,
      })
      .returning();
    expect(await code(createPost(m, post("Olhem isto", { challengeId: draft.id })))).toBe("not_found");
    await db.update(challenges).set({ status: "published" }).where(eq(challenges.id, draft.id));
    expect(await code(createPost(m, post("Agora já é público", { challengeId: draft.id })))).toBe("ok");
  });
});

describe("own account", () => {
  it("profile updates cannot change role, access or email", async () => {
    const m = await mk("sec-self");
    const links = { websiteUrl: "", linkedinUrl: "", githubUrl: "" };
    const u = await updateProfile(m, { name: "Sec Self", ...links, role: "investor", accessTier: "full", email: "x@evil.test", isDemo: true });
    expect(u).toMatchObject({ role: "member", accessTier: "free", email: "sec-self@s.test", isDemo: false });
  });
});
