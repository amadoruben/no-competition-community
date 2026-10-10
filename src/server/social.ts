/**
 * Publications from social networks that the No Competition team selects.
 * Stored as `posts` of kind "social" (the link in `video_url`, an optional
 * cover photo the team uploads), so members react, comment and save them
 * like any post. Nothing is fetched from the networks: no scraping, no
 * unofficial APIs, no credentials. The landing page shows the latest ones.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { postMedia, posts, users, type User } from "@/db/schema";
import { socialSource } from "@/lib/social";
import { mediaFor } from "./community";
import { demoMode } from "./config";
import { invalid, notFound } from "./errors";
import { discard, readImage, store } from "./files";
import { assertInvestor } from "./permissions";
import { isUuid, parse } from "./validation";

const LINK_HELP = "Cole o link de uma publicação do Instagram, TikTok, YouTube ou X.";

const socialInput = z.object({
  url: z
    .string()
    .trim()
    .min(1, LINK_HELP)
    .refine((v) => socialSource(v) !== null, LINK_HELP)
    .transform((v) => socialSource(v)!.url),
  title: z.string().trim().max(140, "Título: máximo 140 caracteres.").default(""),
  caption: z.string().trim().max(2200, "Legenda: máximo 2200 caracteres.").default(""),
});

async function socialPostOf(actor: User, id: string) {
  const [p] = isUuid(id)
    ? await db
        .select({ id: posts.id, isDemo: users.isDemo })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(and(eq(posts.id, id), eq(posts.kind, "social")))
        .limit(1)
    : [];
  if (!p || p.isDemo !== actor.isDemo) throw notFound("Publicação não encontrada.");
  return p;
}

/** Shares a publication in the community (administration only). The cover is optional. */
export async function createSocialPost(actor: User, input: unknown, cover?: unknown) {
  assertInvestor(actor);
  const v = parse(socialInput, input);
  const [dup] = await db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.kind, "social"), eq(posts.videoUrl, v.url), eq(users.isDemo, actor.isDemo)))
    .limit(1);
  if (dup) throw invalid("Esta publicação já foi partilhada na comunidade.", { url: "Já partilhada." });
  const checked = cover instanceof Blob && cover.size > 0 ? await readImage(cover) : null;
  const stored = checked ? await store(actor, `social/${actor.id}`, checked) : null;
  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx.insert(posts).values({ authorId: actor.id, kind: "social", title: v.title, body: v.caption, videoUrl: v.url }).returning();
      if (stored) await tx.insert(postMedia).values({ postId: p.id, fileId: stored.id, position: 0, width: stored.width, height: stored.height });
      return p;
    });
  } catch (e) {
    if (stored) await discard(stored.id);
    throw e;
  }
}

/** Edits the link, title or caption; a new cover replaces the old one, `removeCover` drops it. */
export async function updateSocialPost(actor: User, id: string, input: unknown, cover?: unknown, removeCover = false) {
  assertInvestor(actor);
  const p = await socialPostOf(actor, id);
  const v = parse(socialInput, input);
  const checked = cover instanceof Blob && cover.size > 0 ? await readImage(cover) : null;
  const stored = checked ? await store(actor, `social/${actor.id}`, checked) : null;
  const old = await db.select({ fileId: postMedia.fileId }).from(postMedia).where(eq(postMedia.postId, p.id));
  try {
    const updated = await db.transaction(async (tx) => {
      const [u] = await tx.update(posts).set({ title: v.title, body: v.caption, videoUrl: v.url, editedAt: new Date() }).where(eq(posts.id, p.id)).returning();
      if (stored || removeCover) await tx.delete(postMedia).where(eq(postMedia.postId, p.id));
      if (stored) await tx.insert(postMedia).values({ postId: p.id, fileId: stored.id, position: 0, width: stored.width, height: stored.height });
      return u;
    });
    if (stored || removeCover) await Promise.all(old.map((m) => discard(m.fileId)));
    return updated;
  } catch (e) {
    if (stored) await discard(stored.id);
    throw e;
  }
}

/** Everything shared from the networks on the administration's side, newest first. */
export async function listSocialPosts(actor: User) {
  assertInvestor(actor);
  const rows = await db
    .select({ id: posts.id, title: posts.title, caption: posts.body, url: posts.videoUrl, createdAt: posts.createdAt, authorName: users.name })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.kind, "social"), eq(users.isDemo, actor.isDemo)))
    .orderBy(desc(posts.createdAt));
  const media = await mediaFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, url: r.url ?? "", cover: media.get(r.id)?.[0] ?? null }));
}

/**
 * The latest shared publications for the public landing page: the link, the
 * team's title and caption, and the cover. Outside demo mode, never anything
 * shared by a demonstration account.
 */
export async function publicSocialPosts(limit = 6) {
  const rows = await db
    .select({ id: posts.id, title: posts.title, caption: posts.body, url: posts.videoUrl, createdAt: posts.createdAt, isDemo: users.isDemo })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.kind, "social"), demoMode() ? undefined : eq(users.isDemo, false)))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
  const media = await mediaFor(rows.map((r) => r.id));
  return rows.flatMap(({ isDemo: _, ...r }) => {
    const src = socialSource(r.url);
    return src ? [{ ...r, url: src.url, platform: src.platform, creator: src.creator, youtubeId: src.youtubeId, cover: media.get(r.id)?.[0] ?? null }] : [];
  });
}

/**
 * Whether a stored file may be served without a session: only the cover of a
 * shared social publication, which the team chose to show on the public page
 * (and, outside demo mode, never one from a demonstration account).
 */
export async function isPublicFile(fileId: string) {
  if (!isUuid(fileId)) return false;
  const [row] = await db
    .select({ id: postMedia.fileId })
    .from(postMedia)
    .innerJoin(posts, eq(posts.id, postMedia.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(postMedia.fileId, fileId), inArray(posts.kind, ["social"]), demoMode() ? undefined : eq(users.isDemo, false)))
    .limit(1);
  return !!row;
}
