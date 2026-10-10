/**
 * Publications shared from social networks: only the administration shares
 * them, links are validated and normalised, duplicates are refused, they live
 * in the feed like posts, and only their covers may be served without a
 * session — never any other file.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { postMedia, users, type User } from "@/db/schema";
import { addComment, createPost, listFeed, updatePost } from "../community";
import { DomainError } from "../errors";
import { createSocialPost, isPublicFile, listSocialPosts, publicSocialPosts, updateSocialPost } from "../social";
import { setStorage, type StorageProvider } from "../storage";

const objects = new Map<string, Uint8Array>();
const memory: StorageProvider = {
  name: "memory",
  put: async (k, b) => void objects.set(k, b),
  get: async (k) => (objects.has(k) ? { body: objects.get(k)! } : null),
  delete: async (k) => void objects.delete(k),
};
const demoBefore = process.env.DEMO_MODE;
beforeAll(() => {
  setStorage(memory);
  process.env.DEMO_MODE = "0";
});
afterAll(() => {
  if (demoBefore === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = demoBefore;
});

let n = 0;
const mk = async (role: User["role"] = "member", isDemo = false) => {
  const handle = `sc-${role}-${++n}`;
  return (await db.insert(users).values({ email: `${handle}@sc.test`, authSubject: `s-${handle}`, name: `Pessoa ${n}`, handle, role, isDemo }).returning())[0];
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

describe("sharing social publications", () => {
  it("is for the administration only, with a supported link stored in canonical form", async () => {
    const admin = await mk("investor");
    const member = await mk();
    const link = "https://www.instagram.com/reel/C9xYz12AbCd/?igsh=abc123";
    expect(await code(createSocialPost(member, { url: link }))).toBe("forbidden");
    expect(await code(createSocialPost(admin, { url: "https://example.com/post/1" }))).toBe("invalid");
    expect(await code(createSocialPost(admin, { url: "javascript:alert(1)" }))).toBe("invalid");
    const p = await createSocialPost(admin, { url: link, title: "Bastidores", caption: "A nossa semana." }, png(1080, 1350));
    expect([p.kind, p.videoUrl]).toEqual(["social", "https://www.instagram.com/reel/C9xYz12AbCd/"]);
    expect(await code(createSocialPost(admin, { url: "https://instagram.com/reel/C9xYz12AbCd/" }))).toBe("invalid");
    expect((await listSocialPosts(admin)).find((s) => s.id === p.id)?.cover).toMatchObject({ width: 1080, height: 1350 });
  });

  it("lives in the feed like a post (filter, comments) but is edited only through its own form", async () => {
    const admin = await mk("investor");
    const member = await mk();
    const p = await createSocialPost(admin, { url: "https://youtu.be/dQw4w9WgXcQ", title: "Episódio" });
    expect((await listFeed(member, { kind: "social" })).items.map((i) => i.post.id)).toContain(p.id);
    await addComment(member, p.id, "Muito bom!");
    expect(await code(updatePost(admin, p.id, { kind: "discussion", body: "Trocar o tipo" }))).toBe("forbidden");
    const u = await updateSocialPost(admin, p.id, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Episódio 1" });
    expect(u.title).toBe("Episódio 1");
    // A member cannot make one through the feed composer.
    expect(await code(createPost(member, { kind: "social", title: "", body: "x", videoUrl: "https://youtu.be/dQw4w9WgXcQ" }))).toBe("invalid");
  });
});

describe("the public page", () => {
  it("shows real shared publications, never a demonstration account's", async () => {
    const admin = await mk("investor");
    const demoAdmin = await mk("investor", true);
    const real = await createSocialPost(admin, { url: "https://www.tiktok.com/@manupolonc/video/7412345678901234567", title: "TikTok real" });
    const fake = await createSocialPost(demoAdmin, { url: "https://www.tiktok.com/@demo/video/7412345678901234999", title: "TikTok demo" });
    const shown = (await publicSocialPosts(50)).map((s) => s.id);
    expect(shown).toContain(real.id);
    expect(shown).not.toContain(fake.id);
    expect((await publicSocialPosts(50)).find((s) => s.id === real.id)).toMatchObject({ platform: "tiktok", creator: "manupolonc" });
  });

  it("may load only the covers of shared publications without a session", async () => {
    const admin = await mk("investor");
    const demoAdmin = await mk("investor", true);
    const member = await mk();
    const shared = await createSocialPost(admin, { url: "https://x.com/manupolo/status/1234567890123" }, png(800, 800));
    const demoShared = await createSocialPost(demoAdmin, { url: "https://x.com/demo/status/1234567890999" }, png(800, 800));
    const post = await createPost(member, { kind: "discussion", title: "", body: "Foto privada" }, [png(640, 480)]);
    const fileOf = async (postId: string) => (await db.select({ id: postMedia.fileId }).from(postMedia).where(eq(postMedia.postId, postId)))[0].id;
    expect(await isPublicFile(await fileOf(shared.id))).toBe(true);
    expect(await isPublicFile(await fileOf(demoShared.id))).toBe(false);
    expect(await isPublicFile(await fileOf(post.id))).toBe(false);
    expect(await isPublicFile("not-a-uuid")).toBe(false);
  });
});
