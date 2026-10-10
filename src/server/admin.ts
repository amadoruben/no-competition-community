import { asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { challenges, evaluations, evaluatorAssignments, lessons, participations, posts, results, submissions, users, type User } from "@/db/schema";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { forbidden } from "./errors";
import { decisionHistory } from "./log";
import { assertInvestor, isInvestor } from "./permissions";
import { listOpportunities } from "./review";

export interface NextAction {
  label: string;
  tone: "volt" | "warn" | "info" | "neutral";
}

export interface ChallengeRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  coverHue: number;
  phase: ChallengePhase;
  status: string;
  submissionDeadline: Date;
  resultsDate: Date;
  participants: number;
  submissions: number;
  evaluationsDone: number;
  evaluationsExpected: number;
  viewerPending: number;
  resultsConfirmed: number;
  next: NextAction;
}

const tally = (rows: { k: string; n: number }[]) => new Map(rows.map((r) => [r.k, r.n]));

async function challengeRows(viewer: User, onlyAssigned = false): Promise<ChallengeRow[]> {
  let list = await db.select().from(challenges).orderBy(asc(challenges.submissionDeadline));
  if (onlyAssigned) {
    const mine = await db.select({ id: evaluatorAssignments.challengeId }).from(evaluatorAssignments).where(eq(evaluatorAssignments.evaluatorId, viewer.id));
    const ids = new Set(mine.map((m) => m.id));
    list = list.filter((c) => c.status !== "draft" && (isInvestor(viewer) || ids.has(c.id)));
  }
  if (!list.length) return [];
  const ids = list.map((c) => c.id);
  const [parts, subs, evals, assigned, confirmed] = await Promise.all([
    db.select({ k: participations.challengeId, n: count() }).from(participations).where(inArray(participations.challengeId, ids)).groupBy(participations.challengeId),
    db.select({ id: submissions.id, challengeId: submissions.challengeId }).from(submissions).where(inArray(submissions.challengeId, ids)),
    db
      .select({ evaluatorId: evaluations.evaluatorId, submissionId: evaluations.submissionId, challengeId: submissions.challengeId })
      .from(evaluations)
      .innerJoin(submissions, eq(submissions.id, evaluations.submissionId))
      .where(inArray(submissions.challengeId, ids)),
    db.select({ k: evaluatorAssignments.challengeId, n: count() }).from(evaluatorAssignments).where(inArray(evaluatorAssignments.challengeId, ids)).groupBy(evaluatorAssignments.challengeId),
    db.select({ k: results.challengeId, n: count() }).from(results).where(inArray(results.challengeId, ids)).groupBy(results.challengeId),
  ]);
  const partN = tally(parts);
  const assignedN = tally(assigned);
  const confirmedN = tally(confirmed);
  // Evaluators only see their own progress, never colleagues'.
  const visibleEvals = isInvestor(viewer) ? evals : evals.filter((e) => e.evaluatorId === viewer.id);

  return list.map((c) => {
    const cSubs = subs.filter((s) => s.challengeId === c.id);
    const cEvals = visibleEvals.filter((e) => e.challengeId === c.id);
    const evaluatorCount = isInvestor(viewer) ? (assignedN.get(c.id) ?? 0) : 1;
    const resultsConfirmed = isInvestor(viewer) ? (confirmedN.get(c.id) ?? 0) : 0;
    const viewerPending = cSubs.filter((s) => !evals.some((e) => e.submissionId === s.id && e.evaluatorId === viewer.id)).length;
    const phase = challengePhase(c);
    const expected = cSubs.length * evaluatorCount;

    let next: NextAction;
    if (c.status === "draft") next = { label: "Rever e publicar", tone: "volt" };
    else if (phase === "results") next = { label: "Concluído", tone: "neutral" };
    else if (resultsConfirmed > 0) next = { label: "Publicar resultados", tone: "volt" };
    else if (phase === "reviewing" && c.status === "published") next = { label: "Prazo terminado — encerrar submissões", tone: "warn" };
    else if (c.status === "closed")
      next = cEvals.length < expected ? { label: `Avaliações ${cEvals.length}/${expected}`, tone: "info" } : { label: "Confirmar resultados", tone: "volt" };
    else if (phase === "paused") next = { label: "Em pausa — retomar ou encerrar", tone: "warn" };
    else if (phase === "upcoming") next = { label: "Aguarda abertura", tone: "neutral" };
    else next = { label: `${cSubs.length} ${cSubs.length === 1 ? "submissão recebida" : "submissões recebidas"}`, tone: "info" };

    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category,
      coverHue: c.coverHue,
      phase,
      status: c.status,
      submissionDeadline: c.submissionDeadline,
      resultsDate: c.resultsDate,
      participants: partN.get(c.id) ?? 0,
      submissions: cSubs.length,
      evaluationsDone: cEvals.length,
      evaluationsExpected: expected,
      viewerPending,
      resultsConfirmed,
      next,
    };
  });
}

export async function investorOverview(actor: User) {
  assertInvestor(actor);
  const [rows, opps, history, roles, [assigned], [teamPosts], [videos]] = await Promise.all([
    challengeRows(actor),
    listOpportunities(actor),
    decisionHistory(undefined, 8),
    db.select({ role: users.role, n: count() }).from(users).where(eq(users.isDemo, actor.isDemo)).groupBy(users.role),
    db.select({ n: count() }).from(evaluatorAssignments),
    db.select({ n: count() }).from(posts).innerJoin(users, eq(users.id, posts.authorId)).where(eq(users.role, "investor")),
    db.select({ n: count() }).from(lessons),
  ]);
  const people = (role: User["role"]) => roles.find((r) => r.role === role)?.n ?? 0;
  return {
    rows,
    /** First-use checklist: what a fresh platform still needs from its owner. */
    setup: {
      challengeCreated: rows.length > 0,
      challengePublished: rows.some((r) => r.status !== "draft"),
      hasMembers: people("member") + people("evaluator") > 0,
      hasEvaluators: people("evaluator") > 0,
      evaluatorsAssigned: assigned.n > 0,
      hasPosts: teamPosts.n > 0,
      hasVideos: videos.n > 0,
    },
    kpis: {
      active: rows.filter((r) => ["open", "upcoming", "paused"].includes(r.phase)).length,
      toEvaluate: rows.filter((r) => r.status === "closed").reduce((s, r) => s + r.viewerPending, 0),
      toPublish: rows.filter((r) => r.resultsConfirmed > 0 && r.phase !== "results").length,
      submissions: rows.reduce((s, r) => s + r.submissions, 0),
      pipeline: opps.filter((o) => !["declined", "invested"].includes(o.o.status)).length,
    },
    opportunities: opps,
    history,
  };
}

export async function evaluatorOverview(actor: User) {
  if (actor.role !== "evaluator" && actor.role !== "investor") throw forbidden();
  return challengeRows(actor, true);
}
