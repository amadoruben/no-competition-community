import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  challenges,
  criteria,
  evaluations,
  evaluatorAssignments,
  OPPORTUNITY_STATUSES,
  opportunities,
  posts,
  prizes,
  projectMembers,
  projects,
  results,
  submissions,
  SUBMISSION_STATUSES,
  users,
  type User,
} from "@/db/schema";
import { aggregateSubmission, isCompleteEvaluation, MAX_MARK, rankByScore, weightedScore } from "@/lib/scoring";
import { conflict, forbidden, invalid, notFound } from "./errors";
import { decisionHistory, logDecision } from "./log";
import { assertInvestor, canReview } from "./permissions";
import { parse } from "./validation";

function loadChallenge(id: string) {
  const c = db.select().from(challenges).where(eq(challenges.id, id)).get();
  if (!c) throw notFound("Desafio não encontrado.");
  return c;
}

/** Full review board for a challenge: submissions, scores, ranks, evaluators. */
export function reviewBoard(actor: User, challengeId: string) {
  const c = loadChallenge(challengeId);
  if (!canReview(actor, challengeId)) throw forbidden();
  const crit = db.select().from(criteria).where(eq(criteria.challengeId, challengeId)).orderBy(asc(criteria.position)).all();
  const subs = db
    .select({ s: submissions, project: projects, submitterName: users.name })
    .from(submissions)
    .innerJoin(projects, eq(projects.id, submissions.projectId))
    .innerJoin(users, eq(users.id, submissions.submittedById))
    .where(eq(submissions.challengeId, challengeId))
    .orderBy(asc(submissions.submittedAt))
    .all();
  const evals = subs.length
    ? db
        .select({ e: evaluations, evaluatorName: users.name })
        .from(evaluations)
        .innerJoin(users, eq(users.id, evaluations.evaluatorId))
        .where(inArray(evaluations.submissionId, subs.map((s) => s.s.id)))
        .all()
    : [];
  const evaluators = db
    .select({ id: users.id, name: users.name, role: users.role, headline: users.headline, avatarHue: users.avatarHue })
    .from(evaluatorAssignments)
    .innerJoin(users, eq(users.id, evaluatorAssignments.evaluatorId))
    .where(eq(evaluatorAssignments.challengeId, challengeId))
    .all();
  const confirmed = db.select().from(results).where(eq(results.challengeId, challengeId)).orderBy(asc(results.rank)).all();

  const rows = rankByScore(
    subs.map((s) => {
      const own = evals.filter((e) => e.e.submissionId === s.s.id);
      const agg = aggregateSubmission(s.s.id, own.map((e) => e.e), crit);
      return {
        ...agg,
        submission: s.s,
        project: s.project,
        submitterName: s.submitterName,
        evaluations: own.map((e) => ({
          ...e.e,
          evaluatorName: e.evaluatorName,
          score: weightedScore(e.e.scores, crit),
        })),
        viewerEvaluated: own.some((e) => e.e.evaluatorId === actor.id),
        result: confirmed.find((r) => r.submissionId === s.s.id) ?? null,
      };
    }),
  );
  const pendingForViewer = rows.filter((r) => !r.viewerEvaluated).length;
  return {
    challenge: c,
    criteria: crit,
    prizes: db.select().from(prizes).where(eq(prizes.challengeId, challengeId)).orderBy(asc(prizes.position)).all(),
    rows,
    evaluators,
    confirmed,
    pendingForViewer,
    history: decisionHistory(challengeId),
  };
}

export function getSubmissionForReview(actor: User, submissionId: string) {
  const s = db.select().from(submissions).where(eq(submissions.id, submissionId)).get();
  if (!s) throw notFound("Submissão não encontrada.");
  const board = reviewBoard(actor, s.challengeId);
  const row = board.rows.find((r) => r.submission.id === submissionId)!;
  const team = db
    .select({ name: users.name, handle: users.handle, title: projectMembers.title, avatarHue: users.avatarHue })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, row.project.id))
    .all();
  const mine = row.evaluations.find((e) => e.evaluatorId === actor.id) ?? null;
  const index = board.rows.findIndex((r) => r.submission.id === submissionId);
  const order = [...board.rows].sort((a, b) => +a.submission.submittedAt - +b.submission.submittedAt);
  const pos = order.findIndex((r) => r.submission.id === submissionId);
  return {
    ...board,
    row,
    rankIndex: index,
    team,
    mine,
    prevId: order[pos - 1]?.submission.id ?? null,
    nextId: order[pos + 1]?.submission.id ?? null,
  };
}

const evaluationInput = z.object({
  scores: z.record(z.string(), z.coerce.number().min(0).max(MAX_MARK)),
  feedback: z.string().trim().max(3000).default(""),
});

export function saveEvaluation(actor: User, submissionId: string, input: unknown) {
  const s = db.select().from(submissions).where(eq(submissions.id, submissionId)).get();
  if (!s) throw notFound("Submissão não encontrada.");
  if (!canReview(actor, s.challengeId)) throw forbidden("Não está atribuído(a) a este desafio.");
  const c = loadChallenge(s.challengeId);
  if (c.status === "results_published") throw conflict("Os resultados já foram publicados; as avaliações estão fechadas.");
  const v = parse(evaluationInput, input);
  const crit = db.select().from(criteria).where(eq(criteria.challengeId, s.challengeId)).all();
  const scores = Object.fromEntries(crit.map((cr) => [cr.id, v.scores[cr.id]]));
  if (!isCompleteEvaluation(scores, crit)) throw invalid(`Atribua uma nota de 0 a ${MAX_MARK} a todos os critérios.`);
  db.insert(evaluations)
    .values({ submissionId, evaluatorId: actor.id, scores, feedback: v.feedback })
    .onConflictDoUpdate({
      target: [evaluations.submissionId, evaluations.evaluatorId],
      set: { scores, feedback: v.feedback, updatedAt: new Date() },
    })
    .run();
  return weightedScore(scores, crit);
}

export function setSubmissionStatus(actor: User, submissionId: string, status: unknown) {
  assertInvestor(actor);
  const st = parse(z.enum(SUBMISSION_STATUSES), status);
  const s = db
    .select({ s: submissions, projectName: projects.name })
    .from(submissions)
    .innerJoin(projects, eq(projects.id, submissions.projectId))
    .where(eq(submissions.id, submissionId))
    .get();
  if (!s) throw notFound("Submissão não encontrada.");
  db.update(submissions).set({ status: st, updatedAt: new Date() }).where(eq(submissions.id, submissionId)).run();
  const label = { submitted: "reposta como submetida", shortlisted: "seleccionada para a shortlist", not_selected: "marcada como não seleccionada" }[st];
  logDecision({ challengeId: s.s.challengeId, actorId: actor.id, action: `submission:${st}`, summary: `“${s.projectName}” ${label}.` });
}

const resultsInput = z.object({
  placements: z
    .array(
      z.object({
        submissionId: z.string().min(1),
        rank: z.coerce.number().int().min(1).max(50),
        prizeId: z.string().nullable().default(null),
        note: z.string().trim().max(500).default(""),
      }),
    )
    .min(1, "Seleccione pelo menos um projecto vencedor.")
    .max(20),
});

/** Record the final placements. Members only see them after publication. */
export function confirmResults(actor: User, challengeId: string, input: unknown) {
  assertInvestor(actor);
  const c = loadChallenge(challengeId);
  if (c.status === "results_published") throw conflict("Os resultados já foram publicados.");
  if (c.status !== "closed") throw conflict("Encerre as submissões antes de confirmar resultados.");
  const { placements } = parse(resultsInput, input);

  const ranks = placements.map((p) => p.rank);
  if (new Set(ranks).size !== ranks.length) throw invalid("Cada posição só pode ser atribuída uma vez.");
  const subIds = placements.map((p) => p.submissionId);
  if (new Set(subIds).size !== subIds.length) throw invalid("Cada projecto só pode ocupar uma posição.");
  const valid = db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.challengeId, challengeId), inArray(submissions.id, subIds))).all();
  if (valid.length !== subIds.length) throw invalid("Há submissões que não pertencem a este desafio.");
  const prizeIds = placements.map((p) => p.prizeId).filter((x): x is string => !!x);
  if (new Set(prizeIds).size !== prizeIds.length) throw invalid("Cada prémio só pode ser atribuído uma vez.");
  const validPrizes = prizeIds.length ? db.select({ id: prizes.id }).from(prizes).where(and(eq(prizes.challengeId, challengeId), inArray(prizes.id, prizeIds))).all() : [];
  if (validPrizes.length !== prizeIds.length) throw invalid("Há prémios que não pertencem a este desafio.");

  const board = reviewBoard(actor, challengeId);
  db.transaction((tx) => {
    tx.delete(results).where(eq(results.challengeId, challengeId)).run();
    for (const p of [...placements].sort((a, b) => a.rank - b.rank)) {
      const row = board.rows.find((r) => r.submission.id === p.submissionId)!;
      tx.insert(results)
        .values({ challengeId, submissionId: p.submissionId, rank: p.rank, finalScore: row.score, prizeId: p.prizeId, note: p.note, decidedById: actor.id })
        .run();
    }
  });
  const names = [...placements]
    .sort((a, b) => a.rank - b.rank)
    .map((p) => `${p.rank}.º ${board.rows.find((r) => r.submission.id === p.submissionId)!.project.name}${p.note ? ` (${p.note})` : ""}`)
    .join(", ");
  logDecision({ challengeId, actorId: actor.id, action: "results:confirmed", summary: `Resultados confirmados: ${names}.` });
}

export function publishResults(actor: User, challengeId: string) {
  assertInvestor(actor);
  const c = loadChallenge(challengeId);
  if (c.status === "results_published") throw conflict("Os resultados já foram publicados.");
  const rows = db
    .select({ rank: results.rank, projectName: projects.name, prizeTitle: prizes.title })
    .from(results)
    .innerJoin(submissions, eq(submissions.id, results.submissionId))
    .innerJoin(projects, eq(projects.id, submissions.projectId))
    .leftJoin(prizes, eq(prizes.id, results.prizeId))
    .where(eq(results.challengeId, challengeId))
    .orderBy(asc(results.rank))
    .all();
  if (rows.length === 0) throw conflict("Confirme os resultados antes de os publicar.");
  const now = new Date();
  db.transaction((tx) => {
    tx.update(challenges).set({ status: "results_published", resultsPublishedAt: now }).where(eq(challenges.id, challengeId)).run();
    tx.insert(posts)
      .values({
        authorId: actor.id,
        kind: "announcement",
        title: `Resultados: ${c.title}`,
        body:
          `Os resultados do desafio “${c.title}” estão publicados.\n\n` +
          rows.map((r) => `${r.rank}.º lugar — ${r.projectName}${r.prizeTitle ? ` (${r.prizeTitle})` : ""}`).join("\n") +
          `\n\nObrigado a todas as equipas que submeteram. O feedback dos avaliadores está disponível para cada equipa.`,
        challengeId,
        pinned: true,
      })
      .run();
  });
  logDecision({ challengeId, actorId: actor.id, action: "results:published", summary: `Resultados de “${c.title}” publicados e anunciados à comunidade.` });
}

// ---------------------------------------------------------------------------
// Investment pipeline (separate from results)

const opportunityInput = z.object({
  projectId: z.string().min(1, "Seleccione um projecto."),
  challengeId: z.string().nullable().default(null),
  status: z.enum(OPPORTUNITY_STATUSES),
  amount: z.string().trim().max(80).default(""),
  note: z.string().trim().max(1000).default(""),
});

export const OPPORTUNITY_LABEL: Record<(typeof OPPORTUNITY_STATUSES)[number], string> = {
  interest: "Interesse",
  due_diligence: "Due diligence",
  term_sheet: "Term sheet",
  invested: "Investido",
  declined: "Recusado",
};

export function upsertOpportunity(actor: User, input: unknown, id?: string) {
  assertInvestor(actor);
  const v = parse(opportunityInput, input);
  const project = db.select().from(projects).where(eq(projects.id, v.projectId)).get();
  if (!project) throw invalid("Projecto não encontrado.");
  if (id) {
    const before = db.select().from(opportunities).where(eq(opportunities.id, id)).get();
    if (!before) throw notFound("Oportunidade não encontrada.");
    db.update(opportunities).set({ ...v, updatedAt: new Date() }).where(eq(opportunities.id, id)).run();
    if (before.status !== v.status)
      logDecision({ challengeId: v.challengeId, actorId: actor.id, action: "opportunity:status", summary: `Oportunidade “${project.name}”: ${OPPORTUNITY_LABEL[before.status]} → ${OPPORTUNITY_LABEL[v.status]}.` });
    return id;
  }
  const o = db.insert(opportunities).values({ ...v, createdById: actor.id }).returning().get();
  logDecision({ challengeId: v.challengeId, actorId: actor.id, action: "opportunity:created", summary: `Oportunidade de investimento registada para “${project.name}” (${OPPORTUNITY_LABEL[v.status]}).` });
  return o.id;
}

export function listOpportunities(actor: User) {
  assertInvestor(actor);
  return db
    .select({ o: opportunities, projectName: projects.name, projectSlug: projects.slug, projectTagline: projects.tagline, projectLogoHue: projects.logoHue, projectStage: projects.stage, challengeTitle: challenges.title })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .leftJoin(challenges, eq(challenges.id, opportunities.challengeId))
    .orderBy(asc(opportunities.createdAt))
    .all();
}

/** Feedback visible to the submitting team once results are published. */
export function feedbackForTeam(viewer: User, submissionId: string) {
  const s = db.select().from(submissions).where(eq(submissions.id, submissionId)).get();
  if (!s) return [];
  const c = loadChallenge(s.challengeId);
  const member = db.select().from(projectMembers).where(and(eq(projectMembers.projectId, s.projectId), eq(projectMembers.userId, viewer.id))).get();
  if (!member || c.status !== "results_published") return [];
  return db.select({ feedback: evaluations.feedback }).from(evaluations).where(eq(evaluations.submissionId, submissionId)).all().filter((e) => e.feedback);
}
