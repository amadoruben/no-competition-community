import { eq } from "drizzle-orm";
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

/** Gather the primary facts that points are derived from. */
function loadFacts(): PointFacts {
  const members = db.select({ projectId: projectMembers.projectId, userId: projectMembers.userId }).from(projectMembers).all();
  const teamOf = (projectId: string) => members.filter((m) => m.projectId === projectId).map((m) => m.userId);

  return {
    enrollments: db
      .select({ userId: participations.userId, challengeId: participations.challengeId, at: participations.createdAt })
      .from(participations)
      .all(),
    submissions: db
      .select({ projectId: submissions.projectId, challengeId: submissions.challengeId, at: submissions.submittedAt })
      .from(submissions)
      .all()
      .flatMap((s) => teamOf(s.projectId).map((userId) => ({ userId, challengeId: s.challengeId, at: s.at }))),
    projectUpdates: db.select({ userId: projectUpdates.authorId, at: projectUpdates.createdAt }).from(projectUpdates).all(),
    posts: db.select({ userId: posts.authorId, at: posts.createdAt, kind: posts.kind }).from(posts).all(),
    comments: db.select({ userId: comments.authorId, at: comments.createdAt }).from(comments).all(),
    lessons: db.select({ userId: lessonProgress.userId, at: lessonProgress.completedAt }).from(lessonProgress).all(),
    results: db
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
      .where(eq(challenges.status, "results_published"))
      .all()
      .flatMap((r) => teamOf(r.projectId).map((userId) => ({ ...r, userId, at: r.at ?? new Date() }))),
  };
}

export type LeaderboardView = "overall" | "weekly" | "participation" | "merit";

export interface LeaderboardRow extends Standing {
  name: string;
  handle: string;
  headline: string;
  avatarHue: number;
}

export function leaderboard(view: LeaderboardView, limit = 50): LeaderboardRow[] {
  const people = new Map(
    db
      .select({ id: users.id, name: users.name, handle: users.handle, headline: users.headline, avatarHue: users.avatarHue, role: users.role })
      .from(users)
      .all()
      .filter((u) => u.role === "member")
      .map((u) => [u.id, u]),
  );
  // Rankings are for members; investor and evaluator activity never competes.
  const ledger = buildLedger(loadFacts()).filter((e) => people.has(e.userId));
  const rows =
    view === "weekly"
      ? standings(ledger, { since: new Date(Date.now() - 7 * 864e5) })
      : standings(ledger, { sortBy: view === "overall" ? "total" : view });
  return rows.slice(0, limit).map((r) => {
    const u = people.get(r.userId)!;
    return { ...r, name: u.name, handle: u.handle, headline: u.headline, avatarHue: u.avatarHue };
  });
}

export function memberPoints(userId: string) {
  const ledger = buildLedger(loadFacts());
  const overall = leaderboard("overall", 1000);
  const weekly = leaderboard("weekly", 1000);
  const mine = ledger.filter((e) => e.userId === userId).sort((a, b) => +b.at - +a.at);
  return {
    overall: overall.find((r) => r.userId === userId) ?? null,
    weekly: weekly.find((r) => r.userId === userId) ?? null,
    totalMembers: overall.length,
    recent: mine.slice(0, 8),
  };
}
