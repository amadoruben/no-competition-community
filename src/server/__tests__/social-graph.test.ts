/**
 * Following, suggestions, stories and the weekly digest: who can do what,
 * what each viewer sees, and that nothing crosses between demo and real
 * accounts or reveals exclusive videos.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { challenges, courses, files, follows, lessons, modules, posts, users, type User } from "@/db/schema";
import { createPost, getPost, listFeed, toggleReaction } from "../community";
import { DomainError } from "../errors";
import { profileStats, setFollowing } from "../follows";
import { updateProfile } from "../members";
import { setStorage, type StorageProvider } from "../storage";
import { createStory, deleteStory, listStories, MAX_ACTIVE_STORIES, STORY_DAYS, weeklyDigest } from "../stories";

const objects = new Map<string, Uint8Array>();
const memory: StorageProvider = {
  name: "memory",
  put: async (k, b) => void objects.set(k, b),
  get: async (k) => (objects.has(k) ? { body: objects.get(k)! } : null),
  delete: async (k) => void objects.delete(k),
};
beforeAll(() => setStorage(memory));

let n = 0;
const mk = async (role: User["role"] = "member", isDemo = false, extra: Partial<typeof users.$inferInsert> = {}) => {
  const handle = `sg-${role}-${++n}`;
  return (await db.insert(users).values({ email: `${handle}@sg.test`, authSubject: `s-${handle}`, name: `Pessoa ${n}`, handle, role, isDemo, ...extra }).returning())[0];
};
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof DomainError ? e.code : `raw:${e}`));
const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  const dv = new DataView(b.buffer);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  dv.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return new Blob([b], { type: "image/png" });
};
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5);

describe("following on the social networks (declared, not a social graph)", () => {
  it("records the member's confirmation, repeating it changes nothing, and it can be undone", async () => {
    const [a, host] = [await mk(), await mk("investor")];
    expect(await setFollowing(a, host.id, true)).toEqual({ following: true, followers: 1 });
    expect(await setFollowing(a, host.id, true)).toEqual({ following: true, followers: 1 });
    expect(await profileStats(a, host.id)).toMatchObject({ viewerFollows: true });
    expect(await setFollowing(a, host.id, false)).toEqual({ following: false, followers: 0 });
    expect(await profileStats(a, host.id)).toMatchObject({ viewerFollows: false });
  });

  it("refuses yourself, unknown people and the other side (demo/real); the database refuses self-follows too", async () => {
    const real = await mk();
    const demo = await mk("member", true);
    expect(await code(setFollowing(real, real.id, true))).toBe("invalid");
    expect(await code(setFollowing(real, demo.id, true))).toBe("not_found");
    expect(await code(setFollowing(demo, real.id, true))).toBe("not_found");
    expect(await code(setFollowing(real, "not-a-uuid", true))).toBe("not_found");
    await expect(db.insert(follows).values({ followerId: real.id, followeeId: real.id })).rejects.toThrow();
  });
});

describe("stories", () => {
  it("are published by the team only", async () => {
    const member = await mk();
    expect(await code(createStory(member, { caption: "Olá" }))).toBe("forbidden");
  });

  it("need a photo or a text, stay out of the feed and the post page, and are listed per person", async () => {
    const [a, viewer] = [await mk("investor"), await mk()];
    expect(await code(createStory(a, { caption: "  " }))).toBe("invalid");
    const s1 = await createStory(a, { caption: "Bastidores de hoje" });
    const s2 = await createStory(a, { caption: "" }, png(1080, 1920));
    expect((await listFeed(viewer)).items.some((i) => [s1.id, s2.id].includes(i.post.id))).toBe(false);
    expect(await code(getPost(viewer, s1.id))).toBe("not_found");
    // No comments, reactions or saves through the post paths.
    expect(await code(toggleReaction(viewer, s1.id))).toBe("not_found");
    const group = (await listStories(viewer)).find((g) => g.author.id === a.id)!;
    expect(group.stories.map((s) => s.id)).toEqual([s1.id, s2.id]);
    expect(group.stories[1].photo).toMatchObject({ width: 1080, height: 1920 });
  });

  it("expire after the story window and are never shown across demo and real", async () => {
    const [a, real, demo] = [await mk("investor"), await mk(), await mk("member", true)];
    const old = await createStory(a, { caption: "Antigo" });
    await db.update(posts).set({ createdAt: daysAgo(STORY_DAYS + 1) }).where(eq(posts.id, old.id));
    const fresh = await createStory(a, { caption: "Recente" });
    const shown = (await listStories(real)).flatMap((g) => g.stories.map((s) => s.id));
    expect(shown).toContain(fresh.id);
    expect(shown).not.toContain(old.id);
    expect((await listStories(demo)).some((g) => g.author.id === a.id)).toBe(false);
  });

  it("show the viewer's own stories first, then the most recent", async () => {
    const [me, older, newer] = [await mk("investor"), await mk("investor"), await mk("investor")];
    await createStory(older, { caption: "Mais antigo" });
    await createStory(newer, { caption: "Mais recente" });
    await createStory(me, { caption: "O meu" });
    const order = (await listStories(me)).map((g) => g.author.id).filter((id) => [me.id, older.id, newer.id].includes(id));
    expect(order).toEqual([me.id, newer.id, older.id]);
  });

  it("only the author or the administration delete one, and its photo goes with it", async () => {
    const [a, b, admin] = [await mk("investor"), await mk(), await mk("investor")];
    const filesBefore = (await db.select({ n: count() }).from(files))[0].n;
    const s = await createStory(a, { caption: "" }, png(800, 1000));
    expect(await code(deleteStory(b, s.id))).toBe("forbidden");
    await deleteStory(a, s.id);
    expect((await db.select({ n: count() }).from(files))[0].n).toBe(filesBefore);
    const t = await createStory(a, { caption: "Outro" });
    await deleteStory(admin, t.id);
    expect(await code(deleteStory(a, t.id))).toBe("not_found");
  });

  it("are capped per person", async () => {
    const a = await mk("investor");
    for (let i = 0; i < MAX_ACTIVE_STORIES; i++) await createStory(a, { caption: `Story ${i}` });
    expect(await code(createStory(a, { caption: "Mais um" }))).toBe("invalid");
  });

  it("cannot be created through the feed composer", async () => {
    const a = await mk();
    expect(await code(createPost(a, { kind: "story", title: "", body: "Pelo feed" }))).toBe("invalid");
    expect(await code(createPost(a, { kind: "social", title: "", body: "Pelo feed" }))).toBe("invalid");
  });
});

describe("weekly digest", () => {
  it("lists only real things from this week, and never the title of an exclusive video the viewer cannot open", async () => {
    const admin = await mk("investor");
    const member = await mk();
    const insider = await mk("member", false, { accessTier: "full" });
    const base = { tagline: "Uma frase", description: "Descrição", category: "Teste", startsAt: daysAgo(1), submissionDeadline: new Date(Date.now() + 3 * 864e5), resultsDate: new Date(Date.now() + 20 * 864e5), createdById: admin.id };
    const [fresh] = await db.insert(challenges).values({ ...base, slug: `dg-new-${n}`, title: "Desafio desta semana", status: "published", publishedAt: daysAgo(2) }).returning();
    const [stale] = await db.insert(challenges).values({ ...base, slug: `dg-old-${n}`, title: "Desafio antigo", status: "published", publishedAt: daysAgo(30), submissionDeadline: new Date(Date.now() + 30 * 864e5) }).returning();
    await db.insert(challenges).values({ ...base, slug: `dg-draft-${n}`, title: "Rascunho secreto", status: "draft", publishedAt: null });
    const [course] = await db.insert(courses).values({ slug: `dg-course-${n}`, title: "Colecção Exclusiva DG", description: "x", accessTier: "full" }).returning();
    const [mod] = await db.insert(modules).values({ courseId: course.id, title: "Módulo" }).returning();
    await db.insert(lessons).values({ moduleId: mod.id, slug: "segredo", title: "Título do vídeo secreto", content: "", videoUrl: "https://youtu.be/dQw4w9WgXcQ", createdAt: daysAgo(1) });
    await db.insert(lessons).values({ moduleId: mod.id, slug: "sem-data", title: "Vídeo sem data", content: "", videoUrl: "https://youtu.be/dQw4w9WgXcQ", createdAt: null });

    const forMember = await weeklyDigest(member);
    const text = JSON.stringify(forMember);
    expect(forMember.some((i) => i.title === fresh.title)).toBe(true);
    // Published a month ago and closing in a month: nothing to say about it this week.
    expect(text).not.toContain(stale.title);
    expect(text).not.toContain("Rascunho secreto");
    expect(text).not.toContain("Título do vídeo secreto");
    expect(text).not.toContain("Vídeo sem data");
    expect(forMember.some((i) => i.label === "Novo vídeo exclusivo" && i.title === course.title)).toBe(true);

    const forInsider = await weeklyDigest(insider);
    expect(forInsider.some((i) => i.title === "Título do vídeo secreto")).toBe(true);
    expect(JSON.stringify(forInsider)).not.toContain("Vídeo sem data");
  });
});

describe("social links on profiles", () => {
  it("are stored in canonical form and anything else is refused", async () => {
    const m = await mk();
    const base = { name: m.name, websiteUrl: "", linkedinUrl: "", githubUrl: "" };
    const u = await updateProfile(m, { ...base, instagram: "@manupolonc", tiktok: "https://www.tiktok.com/@manupolonc?_r=1", youtube: "", x: "twitter.com/manupolo" });
    expect(u.socialLinks).toEqual({ instagram: "https://www.instagram.com/manupolonc/", tiktok: "https://www.tiktok.com/@manupolonc", x: "https://x.com/manupolo" });
    expect(await code(updateProfile(m, { ...base, instagram: "javascript:alert(1)" }))).toBe("invalid");
    expect(await code(updateProfile(m, { ...base, youtube: "https://evil.example/@canal" }))).toBe("invalid");
  });
});
