import { and, count, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { challenges, comments, postMedia, posts, POST_KINDS, projects, reactions, savedPosts, users, type PostKind, type User } from "@/db/schema";
import { videoSource } from "@/lib/video";
import { forbidden, invalid, notFound } from "./errors";
import { discard, readImage, store } from "./files";
import { isInvestor, isProjectMember } from "./permissions";
import { isUuid, parse, text } from "./validation";

export { POST_KIND_LABEL } from "@/lib/labels";

/** Photos per post. Each is resized in the browser and checked again here (type, size, dimensions). */
export const MAX_POST_IMAGES = 6;

/**
 * Demo and real accounts never see each other's posts: the feed, a post and
 * every interaction are scoped to authors on the viewer's side.
 */
const sameSide = (viewer: User) => eq(users.isDemo, viewer.isDemo);

function postQuery(viewer: User) {
  return db
    .select({
      post: posts,
      authorName: users.name,
      authorHandle: users.handle,
      authorHue: users.avatarHue,
      authorAvatar: users.avatarFileId,
      authorRole: users.role,
      challengeTitle: challenges.title,
      challengeSlug: challenges.slug,
      projectName: projects.name,
      projectSlug: projects.slug,
      commentCount: sql<number>`(select count(*)::int from ${comments} c where c.post_id = "posts"."id")`,
      reactionCount: sql<number>`(select count(*)::int from ${reactions} r where r.post_id = "posts"."id")`,
      viewerReacted: sql<boolean>`exists(select 1 from ${reactions} r where r.post_id = "posts"."id" and r.user_id = ${viewer.id})`,
      viewerSaved: sql<boolean>`exists(select 1 from ${savedPosts} s where s.post_id = "posts"."id" and s.user_id = ${viewer.id})`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(challenges, eq(challenges.id, posts.challengeId))
    .leftJoin(projects, eq(projects.id, posts.projectId))
    .$dynamic();
}

export type PostMedia = { fileId: string; width: number; height: number };

async function mediaFor(postIds: string[]) {
  const map = new Map<string, PostMedia[]>();
  if (!postIds.length) return map;
  const rows = await db
    .select({ postId: postMedia.postId, fileId: postMedia.fileId, width: postMedia.width, height: postMedia.height })
    .from(postMedia)
    .where(inArray(postMedia.postId, postIds))
    .orderBy(postMedia.postId, postMedia.position);
  for (const { postId, ...m } of rows) map.set(postId, [...(map.get(postId) ?? []), m]);
  return map;
}

const commentFields = {
  c: comments,
  authorName: users.name,
  authorHandle: users.handle,
  authorHue: users.avatarHue,
  authorAvatar: users.avatarFileId,
  authorRole: users.role,
};

/** The latest `per` top-level comments of each post, oldest first, for the feed preview. */
async function previewComments(postIds: string[], per = 2) {
  const map = new Map<string, Awaited<ReturnType<typeof threadOf>>>();
  if (!postIds.length) return map;
  const ranked = db
    .select({ id: comments.id, rn: sql<number>`row_number() over (partition by ${comments.postId} order by ${comments.createdAt} desc)`.as("rn") })
    .from(comments)
    .where(and(inArray(comments.postId, postIds), isNull(comments.parentId)))
    .as("ranked");
  const rows = await db
    .select(commentFields)
    .from(comments)
    .innerJoin(ranked, eq(ranked.id, comments.id))
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(lte(ranked.rn, per))
    .orderBy(comments.createdAt);
  for (const r of rows) map.set(r.c.postId, [...(map.get(r.c.postId) ?? []), r]);
  return map;
}

async function threadOf(postId: string) {
  return db.select(commentFields).from(comments).innerJoin(users, eq(users.id, comments.authorId)).where(eq(comments.postId, postId)).orderBy(comments.createdAt);
}

export type FeedItem = Awaited<ReturnType<typeof listFeed>>["items"][number];
export type FeedComment = FeedItem["comments"][number];

export async function listFeed(viewer: User, opts: { kind?: PostKind; saved?: boolean; limit?: number; page?: number; authorId?: string } = {}) {
  const limit = opts.limit ?? 20;
  const page = Math.max(1, opts.page ?? 1);
  const where = and(
    sameSide(viewer),
    opts.kind ? eq(posts.kind, opts.kind) : undefined,
    opts.authorId ? eq(posts.authorId, opts.authorId) : undefined,
    opts.saved ? sql`exists(select 1 from ${savedPosts} s where s.post_id = "posts"."id" and s.user_id = ${viewer.id})` : undefined,
  );
  // Pinned posts lead the community feed; personal views (saved, a profile) stay chronological.
  const order = opts.saved || opts.authorId ? [desc(posts.createdAt), desc(posts.id)] : [desc(posts.pinned), desc(posts.createdAt), desc(posts.id)];
  const [rows, [{ total }]] = await Promise.all([
    postQuery(viewer)
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(posts).innerJoin(users, eq(users.id, posts.authorId)).where(where),
  ]);
  const ids = rows.map((r) => r.post.id);
  const [media, preview] = await Promise.all([mediaFor(ids), previewComments(ids)]);
  return {
    items: rows.map((r) => ({ ...r, viewerReacted: !!r.viewerReacted, viewerSaved: !!r.viewerSaved, media: media.get(r.post.id) ?? [], comments: preview.get(r.post.id) ?? [] })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getPost(viewer: User, postId: string) {
  const [row] = isUuid(postId) ? await postQuery(viewer).where(and(eq(posts.id, postId), sameSide(viewer))).limit(1) : [];
  if (!row) throw notFound("Publicação não encontrada.");
  const [media, thread] = await Promise.all([mediaFor([postId]), threadOf(postId)]);
  return { ...row, viewerReacted: !!row.viewerReacted, viewerSaved: !!row.viewerSaved, media: media.get(postId) ?? [], comments: thread };
}

/** A post the viewer may see and interact with (same demo/real side), or not found. */
async function visiblePost(viewer: User, postId: string) {
  const [p] = isUuid(postId)
    ? await db
        .select({ id: posts.id, authorId: posts.authorId, kind: posts.kind, title: posts.title, body: posts.body, videoUrl: posts.videoUrl })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(and(eq(posts.id, postId), sameSide(viewer)))
        .limit(1)
    : [];
  if (!p) throw notFound("Publicação não encontrada.");
  return p;
}

const optionalVideo = z
  .string()
  .trim()
  .default("")
  .refine((v) => !v || videoSource(v) !== null, "Use um link do YouTube, do Vimeo ou de um ficheiro de vídeo https (.mp4, .webm).");

const postInput = z.object({
  kind: z.enum(POST_KINDS),
  title: z.string().trim().max(140, "Título: máximo 140 caracteres.").default(""),
  body: z.string().trim().max(5000, "Texto: máximo 5000 caracteres.").default(""),
  videoUrl: optionalVideo,
  challengeId: z.string().refine(isUuid).nullable().default(null),
  projectId: z.string().refine(isUuid).nullable().default(null),
});

const EMPTY = "Escreva algo, ou adicione uma fotografia ou um vídeo.";

export async function createPost(actor: User, input: unknown, images: unknown[] = []) {
  const v = parse(postInput, input);
  if (v.kind === "announcement" && !isInvestor(actor)) throw forbidden("Apenas a equipa No Competition pode publicar anúncios oficiais.");
  if (images.length > MAX_POST_IMAGES) throw invalid(`No máximo ${MAX_POST_IMAGES} fotografias por publicação.`, { images: `Máximo ${MAX_POST_IMAGES}.` });
  if (!v.title && !v.body && !images.length && !v.videoUrl) throw invalid(EMPTY, { body: EMPTY });
  if (v.projectId && !(await isProjectMember(actor.id, v.projectId))) throw forbidden("Só pode associar projectos de que faz parte.");
  if (v.challengeId && !isInvestor(actor)) {
    // A draft challenge is not public yet: linking it would reveal its title in the feed.
    const [c] = await db.select({ status: challenges.status }).from(challenges).where(eq(challenges.id, v.challengeId)).limit(1);
    if (!c || c.status === "draft") throw notFound("Desafio não encontrado.");
  }
  // Every photo is checked before any is stored, so an invalid one stores nothing.
  const checked = await Promise.all(images.map((f) => readImage(f)));
  const stored: Awaited<ReturnType<typeof store>>[] = [];
  try {
    for (const img of checked) stored.push(await store(actor, `posts/${actor.id}`, img));
    return await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(posts)
        .values({ ...v, videoUrl: v.videoUrl || null, authorId: actor.id, pinned: v.kind === "announcement" })
        .returning();
      if (stored.length) await tx.insert(postMedia).values(stored.map((m, position) => ({ postId: p.id, fileId: m.id, position, width: m.width, height: m.height })));
      return p;
    });
  } catch (e) {
    await Promise.all(stored.map((m) => discard(m.id)));
    throw e;
  }
}

const editInput = z.object({
  kind: z.enum(POST_KINDS),
  title: z.string().trim().max(140, "Título: máximo 140 caracteres.").default(""),
  body: z.string().trim().max(5000, "Texto: máximo 5000 caracteres.").default(""),
});

/** Only the author edits the text (title, body, type); photos and video stay as published. */
export async function updatePost(actor: User, postId: string, input: unknown) {
  const p = await visiblePost(actor, postId);
  if (p.authorId !== actor.id) throw forbidden("Só o autor pode editar esta publicação.");
  const v = parse(editInput, input);
  if (v.kind === "announcement" && !isInvestor(actor)) throw forbidden("Apenas a equipa No Competition pode publicar anúncios oficiais.");
  if (!v.title && !v.body && !p.videoUrl) {
    const [m] = await db.select({ n: count() }).from(postMedia).where(eq(postMedia.postId, p.id));
    if (!m.n) throw invalid(EMPTY, { body: EMPTY });
  }
  const [updated] = await db.update(posts).set({ ...v, editedAt: new Date() }).where(eq(posts.id, p.id)).returning();
  return updated;
}

const parentComments = alias(comments, "parent");

export async function addComment(actor: User, postId: string, body: unknown, parentId?: string | null) {
  const v = parse(z.object({ body: text(1, 2000, "Comentário") }), { body });
  const p = await visiblePost(actor, postId);
  let parent: string | null = null;
  if (parentId) {
    const [c] = isUuid(parentId)
      ? await db.select({ id: parentComments.id, postId: parentComments.postId, parentId: parentComments.parentId }).from(parentComments).where(eq(parentComments.id, parentId)).limit(1)
      : [];
    if (!c || c.postId !== p.id) throw notFound("Comentário não encontrado.");
    // Replies stay one level deep: answering a reply joins its thread.
    parent = c.parentId ?? c.id;
  }
  const [c] = await db.insert(comments).values({ postId: p.id, authorId: actor.id, parentId: parent, body: v.body }).returning();
  return c;
}

/** The author removes their comment; the admin moderates any. Its replies go with it. */
export async function deleteComment(actor: User, commentId: string) {
  const [c] = isUuid(commentId)
    ? await db.select({ id: comments.id, authorId: comments.authorId, postId: comments.postId }).from(comments).where(eq(comments.id, commentId)).limit(1)
    : [];
  if (!c) throw notFound("Comentário não encontrado.");
  await visiblePost(actor, c.postId);
  if (c.authorId !== actor.id && !isInvestor(actor)) throw forbidden("Só o autor ou a administração podem remover este comentário.");
  await db.delete(comments).where(eq(comments.id, c.id));
}

const reactionCount = async (postId: string) => (await db.select({ n: count() }).from(reactions).where(eq(reactions.postId, postId)))[0].n;

/**
 * One reaction per member per post (the primary key enforces it): pressing again
 * removes it. Returns the persisted state and the real count.
 */
export async function toggleReaction(actor: User, postId: string) {
  const p = await visiblePost(actor, postId);
  const where = and(eq(reactions.postId, p.id), eq(reactions.userId, actor.id));
  const removed = await db.delete(reactions).where(where).returning();
  if (!removed.length) await db.insert(reactions).values({ postId: p.id, userId: actor.id }).onConflictDoNothing();
  return { active: !removed.length, count: await reactionCount(p.id) };
}

/** Saved posts are private to the member who saved them. */
export async function toggleSaved(actor: User, postId: string) {
  const p = await visiblePost(actor, postId);
  const removed = await db
    .delete(savedPosts)
    .where(and(eq(savedPosts.postId, p.id), eq(savedPosts.userId, actor.id)))
    .returning();
  if (removed.length) return false;
  await db.insert(savedPosts).values({ postId: p.id, userId: actor.id }).onConflictDoNothing();
  return true;
}

export async function setPinned(actor: User, postId: string, pinned: boolean) {
  if (!isInvestor(actor)) throw forbidden();
  const p = await visiblePost(actor, postId);
  await db.update(posts).set({ pinned }).where(eq(posts.id, p.id));
}

/** The author removes their own post; the admin moderates any post. Comments, reactions and photos go with it. */
export async function deletePost(actor: User, postId: string) {
  const p = await visiblePost(actor, postId);
  if (p.authorId !== actor.id && !isInvestor(actor)) throw forbidden("Só o autor ou a administração podem remover esta publicação.");
  const media = await db.select({ fileId: postMedia.fileId }).from(postMedia).where(eq(postMedia.postId, p.id));
  await db.delete(posts).where(eq(posts.id, p.id));
  await Promise.all(media.map((m) => discard(m.fileId)));
}
