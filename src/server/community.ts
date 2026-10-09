import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challenges, comments, posts, POST_KINDS, projects, reactions, users, type PostKind, type User } from "@/db/schema";
import { forbidden, notFound } from "./errors";
import { isInvestor, isProjectMember } from "./permissions";
import { parse, text } from "./validation";

export const POST_KIND_LABEL: Record<PostKind, string> = {
  announcement: "Anúncio",
  discussion: "Discussão",
  progress: "Progresso",
  question: "Pergunta",
};

function postQuery(viewerId: string) {
  return db
    .select({
      post: posts,
      authorName: users.name,
      authorHandle: users.handle,
      authorHue: users.avatarHue,
      authorRole: users.role,
      challengeTitle: challenges.title,
      challengeSlug: challenges.slug,
      projectName: projects.name,
      projectSlug: projects.slug,
      commentCount: sql<number>`(select count(*) from ${comments} c where c.post_id = "posts"."id")`,
      reactionCount: sql<number>`(select count(*) from ${reactions} r where r.post_id = "posts"."id")`,
      viewerReacted: sql<number>`exists(select 1 from ${reactions} r where r.post_id = "posts"."id" and r.user_id = ${viewerId})`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(challenges, eq(challenges.id, posts.challengeId))
    .leftJoin(projects, eq(projects.id, posts.projectId));
}

export type FeedItem = ReturnType<typeof listFeed>[number];

export function listFeed(viewer: User, opts: { kind?: PostKind; limit?: number; authorId?: string } = {}) {
  const where = and(
    opts.kind ? eq(posts.kind, opts.kind) : undefined,
    opts.authorId ? eq(posts.authorId, opts.authorId) : undefined,
  );
  return postQuery(viewer.id)
    .where(where)
    .orderBy(desc(posts.pinned), desc(posts.createdAt))
    .limit(opts.limit ?? 50)
    .all()
    .map((r) => ({ ...r, viewerReacted: !!r.viewerReacted }));
}

export function getPost(viewer: User, postId: string) {
  const row = postQuery(viewer.id).where(eq(posts.id, postId)).get();
  if (!row) throw notFound("Publicação não encontrada.");
  const thread = db
    .select({ c: comments, authorName: users.name, authorHandle: users.handle, authorHue: users.avatarHue, authorRole: users.role })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt)
    .all();
  return { ...row, viewerReacted: !!row.viewerReacted, comments: thread };
}

const postInput = z.object({
  kind: z.enum(POST_KINDS),
  title: text(3, 140, "Título"),
  body: text(3, 5000, "Texto"),
  challengeId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
});

export function createPost(actor: User, input: unknown) {
  const v = parse(postInput, input);
  if (v.kind === "announcement" && !isInvestor(actor)) throw forbidden("Apenas o investidor pode publicar anúncios oficiais.");
  if (v.projectId && !isProjectMember(actor.id, v.projectId)) throw forbidden("Só pode associar projectos de que faz parte.");
  return db
    .insert(posts)
    .values({ ...v, authorId: actor.id, pinned: v.kind === "announcement" })
    .returning()
    .get();
}

export function addComment(actor: User, postId: string, body: unknown) {
  const v = parse(z.object({ body: text(1, 2000, "Comentário") }), { body });
  if (!db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).get()) throw notFound("Publicação não encontrada.");
  return db.insert(comments).values({ postId, authorId: actor.id, body: v.body }).returning().get();
}

export function toggleReaction(actor: User, postId: string) {
  const where = and(eq(reactions.postId, postId), eq(reactions.userId, actor.id));
  if (db.select().from(reactions).where(where).get()) {
    db.delete(reactions).where(where).run();
    return false;
  }
  db.insert(reactions).values({ postId, userId: actor.id }).run();
  return true;
}

export function setPinned(actor: User, postId: string, pinned: boolean) {
  if (!isInvestor(actor)) throw forbidden();
  db.update(posts).set({ pinned }).where(eq(posts.id, postId)).run();
}

export function postsByIds(ids: string[]) {
  return ids.length ? db.select().from(posts).where(inArray(posts.id, ids)).all() : [];
}
