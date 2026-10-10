/**
 * The social feed: photos and video links on posts, reactions, saved posts,
 * comments with replies, editing — with their permissions, persistence and
 * duplicate protection. Demo and real accounts never see each other's posts.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, files, reactions, users, type User } from "@/db/schema";
import { addComment, createPost, deleteComment, deletePost, getPost, listFeed, MAX_POST_IMAGES, toggleReaction, toggleSaved, updatePost } from "../community";
import { DomainError } from "../errors";
import { imageSize } from "../files";
import { setStorage, type StorageProvider } from "../storage";

const objects = new Map<string, Uint8Array>();
const memory: StorageProvider = {
  name: "memory",
  put: async (k, b) => void objects.set(k, b),
  get: async (k) => (objects.has(k) ? { body: objects.get(k)! } : null),
  delete: async (k) => void objects.delete(k),
};
beforeAll(() => setStorage(memory));

let n = 0;
const mk = async (role: User["role"] = "member", isDemo = false) => {
  const handle = `feed-${role}-${++n}`;
  return (await db.insert(users).values({ email: `${handle}@f.test`, authSubject: `s-${handle}`, name: handle, handle, role, isDemo }).returning())[0];
};
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof DomainError ? e.code : `raw:${e}`));
const post = (extra: Record<string, unknown> = {}) => ({ kind: "discussion", title: "", body: "Texto da publicação.", ...extra });
const fileCount = async () => (await db.select({ n: count() }).from(files))[0].n;

/** Minimal valid headers: enough for type sniffing and dimensions (no pixel data is decoded). */
function png(w: number, h: number) {
  const b = new Uint8Array(33);
  const dv = new DataView(b.buffer);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  dv.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return new Blob([b], { type: "image/png" });
}
function jpeg(w: number, h: number) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9]);
}

describe("image dimensions", () => {
  it("are read from the file, not from the browser", async () => {
    expect(imageSize(new Uint8Array(await png(1080, 1350).arrayBuffer()), "image/png")).toEqual({ width: 1080, height: 1350 });
    expect(imageSize(jpeg(1600, 900), "image/jpeg")).toEqual({ width: 1600, height: 900 });
    const webp = new Uint8Array(30);
    webp.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
    webp.set([..."WEBPVP8X"].map((c) => c.charCodeAt(0)), 8);
    webp.set([0x7f, 0x02, 0x00, 0xff, 0x01, 0x00], 24); // 640 × 512, stored minus one
    expect(imageSize(webp, "image/webp")).toEqual({ width: 640, height: 512 });
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0x00]), "image/jpeg")).toBeNull();
  });
});

describe("posts with photos and video", () => {
  it("stores the photos in order with their real size, and removes them with the post", async () => {
    const m = await mk();
    const before = await fileCount();
    const p = await createPost(m, post({ body: "Primeiro protótipo" }), [png(1080, 1350), new Blob([jpeg(1600, 900)], { type: "image/jpeg" })]);
    const item = (await listFeed(m)).items.find((i) => i.post.id === p.id)!;
    expect(item.media.map(({ width, height }) => [width, height])).toEqual([
      [1080, 1350],
      [1600, 900],
    ]);
    expect(await fileCount()).toBe(before + 2);
    await deletePost(m, p.id);
    expect(await fileCount()).toBe(before);
    expect(objects.size).toBe(0);
  });

  it("rejects anything that is not a photo, without storing the valid ones", async () => {
    const m = await mk();
    const before = await fileCount();
    const fake = new Blob(["<svg onload=alert(1)>"], { type: "image/png" });
    expect(await code(createPost(m, post(), [png(10, 10), fake]))).toBe("invalid");
    expect(await code(createPost(m, post(), Array.from({ length: MAX_POST_IMAGES + 1 }, () => png(10, 10))))).toBe("invalid");
    expect(await fileCount()).toBe(before);
  });

  it("needs some content, and accepts only supported video links", async () => {
    const m = await mk();
    expect(await code(createPost(m, post({ body: "" })))).toBe("invalid");
    expect(await code(createPost(m, post({ body: "", videoUrl: "https://evil.test/v" })))).toBe("invalid");
    expect(await code(createPost(m, post({ body: "", videoUrl: "javascript:alert(1)" })))).toBe("invalid");
    const v = await createPost(m, post({ body: "", videoUrl: "https://youtu.be/dQw4w9WgXcQ" }));
    expect(v.videoUrl).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(await code(createPost(m, post({ body: "", title: "Só título" })))).toBe("ok");
  });
});

describe("reactions", () => {
  it("one per member: toggling adds and removes, the count is real, duplicates are impossible", async () => {
    const [a, b, author] = [await mk(), await mk(), await mk()];
    const p = await createPost(author, post());
    expect(await toggleReaction(a, p.id)).toEqual({ active: true, count: 1 });
    expect(await toggleReaction(b, p.id)).toEqual({ active: true, count: 2 });
    expect(await toggleReaction(a, p.id)).toEqual({ active: false, count: 1 });
    expect(await toggleReaction(a, p.id)).toEqual({ active: true, count: 2 });
    // The database itself refuses a second reaction from the same member.
    await expect(db.insert(reactions).values({ postId: p.id, userId: a.id })).rejects.toThrow();
    const seen = await getPost(a, p.id);
    expect([seen.reactionCount, seen.viewerReacted]).toEqual([2, true]);
    expect((await getPost(author, p.id)).viewerReacted).toBe(false);
  });
});

describe("saved posts", () => {
  it("are private to the member and persist", async () => {
    const [a, b] = [await mk(), await mk()];
    const p = await createPost(b, post({ body: "Para ler mais tarde" }));
    expect(await toggleSaved(a, p.id)).toBe(true);
    expect((await listFeed(a, { saved: true })).items.map((i) => i.post.id)).toEqual([p.id]);
    expect((await listFeed(b, { saved: true })).items).toEqual([]);
    expect((await getPost(a, p.id)).viewerSaved).toBe(true);
    expect(await toggleSaved(a, p.id)).toBe(false);
    expect((await listFeed(a, { saved: true })).items).toEqual([]);
  });
});

describe("comments and replies", () => {
  it("replies stay one level deep and belong to the same post", async () => {
    const [a, b] = [await mk(), await mk()];
    const p = await createPost(a, post());
    const other = await createPost(a, post());
    const top = await addComment(b, p.id, "Como mediram a poupança?");
    const reply = await addComment(a, p.id, "Com um sensor de pinça.", top.id);
    const deeper = await addComment(b, p.id, "Obrigado!", reply.id);
    expect([reply.parentId, deeper.parentId]).toEqual([top.id, top.id]);
    expect(await code(addComment(b, other.id, "Noutra publicação", top.id))).toBe("not_found");
    expect(await code(addComment(b, p.id, "   "))).toBe("invalid");
    const thread = (await getPost(b, p.id)).comments;
    expect(thread.map((c) => c.c.body)).toEqual(["Como mediram a poupança?", "Com um sensor de pinça.", "Obrigado!"]);
    // The feed previews top-level comments only.
    expect((await listFeed(b)).items.find((i) => i.post.id === p.id)!.comments.map((c) => c.c.id)).toEqual([top.id]);
  });

  it("the author or the admin removes a comment, with its replies", async () => {
    const [a, b, admin] = [await mk(), await mk(), await mk("investor")];
    const p = await createPost(a, post());
    const top = await addComment(b, p.id, "Comentário");
    await addComment(a, p.id, "Resposta", top.id);
    expect(await code(deleteComment(a, top.id))).toBe("forbidden");
    await deleteComment(b, top.id);
    expect((await db.select({ n: count() }).from(comments).where(eq(comments.postId, p.id)))[0].n).toBe(0);
    const again = await addComment(b, p.id, "Outro");
    await deleteComment(admin, again.id);
  });
});

describe("editing", () => {
  it("only the author edits; the post is marked as edited", async () => {
    const [a, b, admin] = [await mk(), await mk(), await mk("investor")];
    const p = await createPost(a, post({ body: "Versão 1" }));
    expect(await code(updatePost(b, p.id, { kind: "discussion", body: "Hack" }))).toBe("forbidden");
    expect(await code(updatePost(admin, p.id, { kind: "discussion", body: "Moderação não edita" }))).toBe("forbidden");
    expect(await code(updatePost(a, p.id, { kind: "announcement", body: "Oficial?" }))).toBe("forbidden");
    expect(await code(updatePost(a, p.id, { kind: "discussion", title: "", body: "" }))).toBe("invalid");
    const u = await updatePost(a, p.id, { kind: "question", title: "Dúvida", body: "Versão 2" });
    expect([u.kind, u.body, u.editedAt instanceof Date]).toEqual(["question", "Versão 2", true]);
  });
});

describe("demo and real accounts", () => {
  it("never see or touch each other's posts", async () => {
    const demo = await mk("member", true);
    const real = await mk();
    const p = await createPost(demo, post({ body: "Publicação de demonstração" }));
    expect((await listFeed(real)).items.some((i) => i.post.id === p.id)).toBe(false);
    expect((await listFeed(demo)).items.some((i) => i.post.id === p.id)).toBe(true);
    // One at a time, each handled as it starts (on a real server they would otherwise race).
    for (const attempt of [() => getPost(real, p.id), () => toggleReaction(real, p.id), () => toggleSaved(real, p.id), () => addComment(real, p.id, "Olá")])
      expect(await code(attempt())).toBe("not_found");
  });
});
