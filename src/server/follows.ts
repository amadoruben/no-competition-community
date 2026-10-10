/**
 * "Segue nas redes": a member confirms they follow someone — the community's
 * host above all — on that person's social networks. Only the member's own
 * confirmation is recorded (the networks do not let anyone verify it). It is
 * not a social graph: members do not follow each other inside the community,
 * and it opens nothing the member could not already see. Demo and real
 * accounts never mix, and nobody "follows" themselves (the database refuses it).
 */
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { follows, posts, POST_KINDS, users, type User } from "@/db/schema";
import { invalid, notFound } from "./errors";
import { isUuid } from "./validation";

/** Someone the viewer may follow: exists, same side, not the viewer. */
async function followable(viewer: User, userId: string) {
  const [u] = isUuid(userId) ? await db.select({ id: users.id, isDemo: users.isDemo }).from(users).where(eq(users.id, userId)).limit(1) : [];
  if (!u || u.isDemo !== viewer.isDemo) throw notFound("Membro não encontrado.");
  if (u.id === viewer.id) throw invalid("Não pode seguir a sua própria conta.");
  return u;
}

/** Sets the desired state (not a toggle), so a repeated click can never undo itself. */
export async function setFollowing(viewer: User, userId: string, follow: boolean) {
  const u = await followable(viewer, userId);
  if (follow) await db.insert(follows).values({ followerId: viewer.id, followeeId: u.id }).onConflictDoNothing();
  else await db.delete(follows).where(and(eq(follows.followerId, viewer.id), eq(follows.followeeId, u.id)));
  const [{ n }] = await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, u.id));
  return { following: follow, followers: n };
}

/** Ids of the people the viewer follows. */
export async function followeeIds(viewerId: string) {
  return (await db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewerId))).map((r) => r.id);
}

/** For a profile: how many posts the member published in the feed, and whether the viewer confirmed following them on the networks. */
export async function profileStats(viewer: User, userId: string) {
  const [[p], [mine]] = await Promise.all([
    db.select({ n: count() }).from(posts).where(and(eq(posts.authorId, userId), inArray(posts.kind, [...POST_KINDS]))),
    db.select({ n: count() }).from(follows).where(and(eq(follows.followerId, viewer.id), eq(follows.followeeId, userId))),
  ]);
  return { posts: p.n, viewerFollows: mine.n > 0 };
}
