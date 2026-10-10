import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  challenges,
  comments,
  lessonProgress,
  participations,
  posts,
  projectMembers,
  projectUpdates,
  results,
  submissions,
  users,
} from "@/db/schema";
import { buildLedger, standings, type PointFacts, type Standing } from "@/lib/points";

/**
 * Gather the primary facts that points are derived from.
 * Cost grows linearly with activity; fine for thousands of members. Beyond
 * that, materialise the ledger (e.g. a nightly table) behind this function.
 */
async function loadFacts(): Promise<PointFacts> {
  const [members, enrollments, subs, updates, postRows, commentRows, lessons, resultRows] = await Promise.all([
    db.select({ projectId: projectMembers.projectId, userId: projectMembers.userId }).from(projectMembers),
    db.select({ userId: participations.userId, challengeId: participations.challengeId, at: participations.createdAt }).from(participations),
    db.select({ projectId: submissions.projectId, challengeId: submissions.challengeId, at: submissions.submittedAt }).from(submissions),
    db.select({ userId: projectUpdates.authorId, at: projectUpdates.createdAt }).from(projectUpdates),
    db.select({ userId: posts.authorId, at: posts.createdAt, kind: posts.kind }).from(posts),
    db.select({ userId: comments.authorId, at: comments.createdAt }).from(comments),
    db.select({ userId: lessonProgress.userId, at: lessonProgress.completedAt }).from(lessonProgress),
    db
      .select({
        projectId: submissions.projectId,
        challengeId: results.challengeId,
        challengeTitle: challenges.title,
        rank: results.rank,
        finalScore: results.finalScore,
        placementPoints: challenges.placementPoints,
        at: challenges.resultsPublishedAt,
      })
      .from(results)
      .innerJoin(submissions, eq(submissions.id, results.submissionId))
      .innerJoin(challenges, eq(challenges.id, results.challengeId))
      .where(eq(challenges.status, "results_published")),
  ]);
  const teamOf = (projectId: string) => members.filter((m) => m.projectId === projectId).map((m) => m.userId);
  return {
    enrollments,
    submissions: subs.flatMap((s) => teamOf(s.projectId).map((userId) => ({ userId, challengeId: s.challengeId, at: s.at }))),
    projectUpdates: updates,
    posts: postRows,
    comments: commentRows,
    lessons,
    results: resultRows.flatMap((r) => teamOf(r.projectId).map((userId) => ({ ...r, userId, at: r.at ?? new Date() }))),
  };
}

/** Ledger restricted to members: investor and evaluator activity never competes. Memoised per request. */
const memberLedger = cache(async () => {
  const [facts, people] = await Promise.all([
    loadFacts(),
    db
      .select({ id: users.id, name: users.name, handle: users.handle, headline: users.headline, avatarHue: users.avatarHue })
      .from(users)
      .where(eq(users.role, "member")),
  ]);
  const byId = new Map(people.map((u) => [u.id, u]));
  return { ledger: buildLedger(facts).filter((e) => byId.has(e.userId)), people: byId };
});

export type LeaderboardView = "overall" | "weekly" | "participation" | "merit";

export interface LeaderboardRow extends Standing {
  name: string;
  handle: string;
  headline: string;
  avatarHue: number;
}

export async function leaderboard(view: LeaderboardView, limit = 50): Promise<LeaderboardRow[]> {
  const { ledger, people } = await memberLedger();
  const rows =
    view === "weekly"
      ? standings(ledger, { since: new Date(Date.now() - 7 * 864e5) })
      : standings(ledger, { sortBy: view === "overall" ? "total" : view });
  return rows.slice(0, limit).map((r) => {
    const u = people.get(r.userId)!;
    return { ...r, name: u.name, handle: u.handle, headline: u.headline, avatarHue: u.avatarHue };
  });
}

export async function memberPoints(userId: string) {
  const [{ ledger }, overall, weekly] = await Promise.all([memberLedger(), leaderboard("overall", 100000), leaderboard("weekly", 100000)]);
  const mine = ledger.filter((e) => e.userId === userId).sort((a, b) => +b.at - +a.at);
  return {
    overall: overall.find((r) => r.userId === userId) ?? null,
    weekly: weekly.find((r) => r.userId === userId) ?? null,
    totalMembers: overall.length,
    ranked: overall,
    recent: mine.slice(0, 8),
  };
}
