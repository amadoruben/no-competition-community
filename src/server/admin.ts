import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { challenges, evaluations, evaluatorAssignments, participations, results, submissions, type User } from "@/db/schema";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { decisionHistory } from "./log";
import { assertInvestor, canReview } from "./permissions";
import { listOpportunities } from "./review";
import { forbidden } from "./errors";

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

function challengeRows(viewer: User, onlyAssigned = false): ChallengeRow[] {
  const all = db.select().from(challenges).orderBy(asc(challenges.submissionDeadline)).all();
  return all
    .filter((c) => (onlyAssigned ? canReview(viewer, c.id) && c.status !== "draft" : true))
    .map((c) => {
      const participants = db.select({ n: sql<number>`count(*)` }).from(participations).where(eq(participations.challengeId, c.id)).get()!.n;
      const subs = db.select({ id: submissions.id }).from(submissions).where(eq(submissions.challengeId, c.id)).all();
      const evals = db
        .select({ evaluatorId: evaluations.evaluatorId, submissionId: evaluations.submissionId })
        .from(evaluations)
        .innerJoin(submissions, eq(submissions.id, evaluations.submissionId))
        .where(eq(submissions.challengeId, c.id))
        .all();
      const evaluatorCount = db.select({ n: sql<number>`count(*)` }).from(evaluatorAssignments).where(eq(evaluatorAssignments.challengeId, c.id)).get()!.n;
      const confirmed = db.select({ n: sql<number>`count(*)` }).from(results).where(eq(results.challengeId, c.id)).get()!.n;
      const viewerPending = subs.filter((s) => !evals.some((e) => e.submissionId === s.id && e.evaluatorId === viewer.id)).length;
      const phase = challengePhase(c);
      const expected = subs.length * evaluatorCount;

      let next: NextAction;
      if (c.status === "draft") next = { label: "Rever e publicar", tone: "volt" };
      else if (phase === "results") next = { label: "Concluído", tone: "neutral" };
      else if (confirmed > 0) next = { label: "Publicar resultados", tone: "volt" };
      else if (phase === "reviewing" && c.status === "published") next = { label: "Prazo terminado — encerrar submissões", tone: "warn" };
      else if (c.status === "closed")
        next = evals.length < expected ? { label: `Avaliações ${evals.length}/${expected}`, tone: "info" } : { label: "Confirmar resultados", tone: "volt" };
      else if (phase === "paused") next = { label: "Em pausa — retomar ou encerrar", tone: "warn" };
      else if (phase === "upcoming") next = { label: "Aguarda abertura", tone: "neutral" };
      else next = { label: `${subs.length} submissões recebidas`, tone: "info" };

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
        participants,
        submissions: subs.length,
        evaluationsDone: evals.length,
        evaluationsExpected: expected,
        viewerPending,
        resultsConfirmed: confirmed,
        next,
      };
    });
}

export function investorOverview(actor: User) {
  assertInvestor(actor);
  const rows = challengeRows(actor);
  const opps = listOpportunities(actor);
  return {
    rows,
    kpis: {
      active: rows.filter((r) => ["open", "upcoming", "paused"].includes(r.phase)).length,
      toEvaluate: rows.filter((r) => r.status === "closed").reduce((s, r) => s + r.viewerPending, 0),
      toPublish: rows.filter((r) => r.resultsConfirmed > 0 && r.phase !== "results").length,
      submissions: rows.reduce((s, r) => s + r.submissions, 0),
      pipeline: opps.filter((o) => !["declined", "invested"].includes(o.o.status)).length,
    },
    opportunities: opps,
    history: decisionHistory(undefined, 8),
  };
}

export function evaluatorOverview(actor: User) {
  if (actor.role !== "evaluator" && actor.role !== "investor") throw forbidden();
  return challengeRows(actor, true);
}
