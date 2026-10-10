import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challenges, comments, posts, POST_KINDS, projects, reactions, users, type PostKind, type User } from "@/db/schema";
import { forbidden, notFound } from "./errors";
import { isInvestor, isProjectMember } from "./permissions";
import { isUuid, parse, text } from "./validation";

export { POST_KIND_LABEL } from "@/lib/labels";

function postQuery(viewerId: string) {
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
      viewerReacted: sql<boolean>`exists(select 1 from ${reactions} r where r.post_id = "posts"."id" and r.user_id = ${viewerId})`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(challenges, eq(challenges.id, posts.challengeId))
    .leftJoin(projects, eq(projects.id, posts.projectId))
    .$dynamic();
}

export type FeedItem = Awaited<ReturnType<typeof listFeed>>["items"][number];

export async function listFeed(viewer: User, opts: { kind?: PostKind; limit?: number; page?: number; authorId?: string } = {}) {
  const limit = opts.limit ?? 20;
  const page = Math.max(1, opts.page ?? 1);
  const where = and(opts.kind ? eq(posts.kind, opts.kind) : undefined, opts.authorId ? eq(posts.authorId, opts.authorId) : undefined);
  const [rows, [{ total }]] = await Promise.all([
    postQuery(viewer.id)
      .where(where)
      .orderBy(desc(posts.pinned), desc(posts.createdAt), desc(posts.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(posts).where(where),
  ]);
  return { items: rows.map((r) => ({ ...r, viewerReacted: !!r.viewerReacted })), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getPost(viewer: User, postId: string) {
  const [row] = isUuid(postId) ? await postQuery(viewer.id).where(eq(posts.id, postId)).limit(1) : [];
  if (!row) throw notFound("Publicação não encontrada.");
  const thread = await db
    .select({ c: comments, authorName: users.name, authorHandle: users.handle, authorHue: users.avatarHue, authorAvatar: users.avatarFileId, authorRole: users.role })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt);
  return { ...row, viewerReacted: !!row.viewerReacted, comments: thread };
}

const postInput = z.object({
  kind: z.enum(POST_KINDS),
  title: text(3, 140, "Título"),
  body: text(3, 5000, "Texto"),
  challengeId: z.string().refine(isUuid).nullable().default(null),
  projectId: z.string().refine(isUuid).nullable().default(null),
});

export async function createPost(actor: User, input: unknown) {
  const v = parse(postInput, input);
  if (v.kind === "announcement" && !isInvestor(actor)) throw forbidden("Apenas a equipa No Competition pode publicar anúncios oficiais.");
  if (v.projectId && !(await isProjectMember(actor.id, v.projectId))) throw forbidden("Só pode associar projectos de que faz parte.");
  if (v.challengeId && !isInvestor(actor)) {
    // A draft challenge is not public yet: linking it would reveal its title in the feed.
    const [c] = await db.select({ status: challenges.status }).from(challenges).where(eq(challenges.id, v.challengeId)).limit(1);
    if (!c || c.status === "draft") throw notFound("Desafio não encontrado.");
  }
  const [p] = await db
    .insert(posts)
    .values({ ...v, authorId: actor.id, pinned: v.kind === "announcement" })
    .returning();
  return p;
}

export async function addComment(actor: User, postId: string, body: unknown) {
  const v = parse(z.object({ body: text(1, 2000, "Comentário") }), { body });
  const [exists] = isUuid(postId) ? await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1) : [];
  if (!exists) throw notFound("Publicação não encontrada.");
  const [c] = await db.insert(comments).values({ postId, authorId: actor.id, body: v.body }).returning();
  return c;
}

export async function toggleReaction(actor: User, postId: string) {
  if (!isUuid(postId)) throw notFound("Publicação não encontrada.");
  const where = and(eq(reactions.postId, postId), eq(reactions.userId, actor.id));
  const removed = await db.delete(reactions).where(where).returning();
  if (removed.length) return false;
  await db.insert(reactions).values({ postId, userId: actor.id }).onConflictDoNothing();
  return true;
}

export async function setPinned(actor: User, postId: string, pinned: boolean) {
  if (!isInvestor(actor)) throw forbidden();
  if (!isUuid(postId)) throw notFound("Publicação não encontrada.");
  await db.update(posts).set({ pinned }).where(eq(posts.id, postId));
}

/** The author removes their own post; the admin moderates any post. Comments and reactions go with it. */
export async function deletePost(actor: User, postId: string) {
  const [p] = isUuid(postId) ? await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1) : [];
  if (!p) throw notFound("Publicação não encontrada.");
  if (p.authorId !== actor.id && !isInvestor(actor)) throw forbidden("Só o autor ou a administração podem remover esta publicação.");
  await db.delete(posts).where(eq(posts.id, postId));
}
