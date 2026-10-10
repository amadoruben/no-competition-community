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
import { decisionHistory, logDecision, type HistoryEntry } from "./log";
import { assertInvestor, canReview, isInvestor } from "./permissions";
import { isUuid, parse } from "./validation";

async function loadChallenge(id: string) {
  const [c] = isUuid(id) ? await db.select().from(challenges).where(eq(challenges.id, id)).limit(1) : [];
  if (!c) throw notFound("Desafio não encontrado.");
  return c;
}

async function loadSubmission(id: string) {
  const [s] = isUuid(id) ? await db.select().from(submissions).where(eq(submissions.id, id)).limit(1) : [];
  if (!s) throw notFound("Submissão não encontrada.");
  return s;
}

/**
 * Review board for a challenge.
 *
 * Confidentiality is enforced here, not in the UI: an evaluator's board is
 * built only from their own evaluations — no colleague marks, no aggregate
 * scores, no ranks, no confirmed results and no decision history. Only the
 * investor receives the full picture.
 */
export async function reviewBoard(actor: User, challengeId: string) {
  const c = await loadChallenge(challengeId);
  if (!(await canReview(actor, challengeId))) throw forbidden();
  const full = isInvestor(actor);

  const [crit, subs, evaluators, confirmed, prz, history] = await Promise.all([
    db.select().from(criteria).where(eq(criteria.challengeId, challengeId)).orderBy(asc(criteria.position)),
    db
      .select({ s: submissions, project: projects, submitterName: users.name })
      .from(submissions)
      .innerJoin(projects, eq(projects.id, submissions.projectId))
      .innerJoin(users, eq(users.id, submissions.submittedById))
      .where(eq(submissions.challengeId, challengeId))
      .orderBy(asc(submissions.submittedAt)),
    db
      .select({ id: users.id, name: users.name, role: users.role, headline: users.headline, avatarHue: users.avatarHue })
      .from(evaluatorAssignments)
      .innerJoin(users, eq(users.id, evaluatorAssignments.evaluatorId))
      .where(eq(evaluatorAssignments.challengeId, challengeId)),
    full ? db.select().from(results).where(eq(results.challengeId, challengeId)).orderBy(asc(results.rank)) : Promise.resolve([]),
    db.select().from(prizes).where(eq(prizes.challengeId, challengeId)).orderBy(asc(prizes.position)),
    full ? decisionHistory(challengeId) : Promise.resolve([] as HistoryEntry[]),
  ]);
  const evals = subs.length
    ? await db
        .select({ e: evaluations, evaluatorName: users.name })
        .from(evaluations)
        .innerJoin(users, eq(users.id, evaluations.evaluatorId))
        .where(
          and(
            inArray(evaluations.submissionId, subs.map((s) => s.s.id)),
            full ? undefined : eq(evaluations.evaluatorId, actor.id),
          ),
        )
    : [];

  const built = subs.map((s) => {
    const own = evals.filter((e) => e.e.submissionId === s.s.id);
    const agg = aggregateSubmission(s.s.id, own.map((e) => e.e), crit);
    return {
      ...agg,
      submission: s.s,
      project: s.project,
      submitterName: s.submitterName,
      evaluations: own.map((e) => ({ ...e.e, evaluatorName: e.evaluatorName, score: weightedScore(e.e.scores, crit) })),
      viewerEvaluated: own.some((e) => e.e.evaluatorId === actor.id),
      result: confirmed.find((r) => r.submissionId === s.s.id) ?? null,
    };
  });
  const rows = full ? rankByScore(built) : built.map((r) => ({ ...r, rank: null as number | null }));
  return {
    challenge: c,
    criteria: crit,
    prizes: prz,
    rows,
    evaluators,
    confirmed,
    pendingForViewer: rows.filter((r) => !r.viewerEvaluated).length,
    history,
    full,
  };
}

export type ReviewBoard = Awaited<ReturnType<typeof reviewBoard>>;

export async function getSubmissionForReview(actor: User, submissionId: string) {
  const s = await loadSubmission(submissionId);
  const board = await reviewBoard(actor, s.challengeId);
  const row = board.rows.find((r) => r.submission.id === submissionId)!;
  const team = await db
    .select({ name: users.name, handle: users.handle, title: projectMembers.title, avatarHue: users.avatarHue })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, row.project.id));
  const mine = row.evaluations.find((e) => e.evaluatorId === actor.id) ?? null;
  const order = [...board.rows].sort((a, b) => +a.submission.submittedAt - +b.submission.submittedAt);
  const pos = order.findIndex((r) => r.submission.id === submissionId);
  return {
    ...board,
    row,
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

export async function saveEvaluation(actor: User, submissionId: string, input: unknown) {
  const s = await loadSubmission(submissionId);
  if (!(await canReview(actor, s.challengeId))) throw forbidden("Não está atribuído(a) a este desafio.");
  const c = await loadChallenge(s.challengeId);
  if (c.status === "results_published") throw conflict("Os resultados já foram publicados; as avaliações estão fechadas.");
  const v = parse(evaluationInput, input);
  const crit = await db.select().from(criteria).where(eq(criteria.challengeId, s.challengeId));
  const scores = Object.fromEntries(crit.map((cr) => [cr.id, v.scores[cr.id]]));
  if (!isCompleteEvaluation(scores, crit)) throw invalid(`Atribua uma nota de 0 a ${MAX_MARK} a todos os critérios.`);
  await db
    .insert(evaluations)
    .values({ submissionId, evaluatorId: actor.id, scores, feedback: v.feedback })
    .onConflictDoUpdate({
      target: [evaluations.submissionId, evaluations.evaluatorId],
      set: { scores, feedback: v.feedback, updatedAt: new Date() },
    });
  return weightedScore(scores, crit);
}

export async function setSubmissionStatus(actor: User, submissionId: string, status: unknown) {
  assertInvestor(actor);
  const st = parse(z.enum(SUBMISSION_STATUSES), status);
  const s = await loadSubmission(submissionId);
  const [p] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, s.projectId));
  const label = { submitted: "reposta como submetida", shortlisted: "seleccionada para a shortlist", not_selected: "marcada como não seleccionada" }[st];
  await db.transaction(async (tx) => {
    await tx.update(submissions).set({ status: st, updatedAt: new Date() }).where(eq(submissions.id, submissionId));
    await logDecision({ challengeId: s.challengeId, actorId: actor.id, action: `submission:${st}`, summary: `“${p.name}” ${label}.` }, tx);
  });
}

const resultsInput = z.object({
  placements: z
    .array(
      z.object({
        submissionId: z.string().refine(isUuid, "Submissão inválida."),
        rank: z.coerce.number().int().min(1).max(50),
        prizeId: z.string().refine(isUuid, "Prémio inválido.").nullable().default(null),
        note: z.string().trim().max(500).default(""),
      }),
    )
    .min(1, "Seleccione pelo menos um projecto vencedor.")
    .max(20),
});

/** Record the final placements. Members only see them after publication. */
export async function confirmResults(actor: User, challengeId: string, input: unknown) {
  assertInvestor(actor);
  const c = await loadChallenge(challengeId);
  if (c.status === "results_published") throw conflict("Os resultados já foram publicados.");
  if (c.status !== "closed") throw conflict("Encerre as submissões antes de confirmar resultados.");
  const { placements } = parse(resultsInput, input);

  const ranks = placements.map((p) => p.rank);
  if (new Set(ranks).size !== ranks.length) throw invalid("Cada posição só pode ser atribuída uma vez.");
  const subIds = placements.map((p) => p.submissionId);
  if (new Set(subIds).size !== subIds.length) throw invalid("Cada projecto só pode ocupar uma posição.");
  const valid = await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.challengeId, challengeId), inArray(submissions.id, subIds)));
  if (valid.length !== subIds.length) throw invalid("Há submissões que não pertencem a este desafio.");
  const prizeIds = placements.map((p) => p.prizeId).filter((x): x is string => !!x);
  if (new Set(prizeIds).size !== prizeIds.length) throw invalid("Cada prémio só pode ser atribuído uma vez.");
  const validPrizes = prizeIds.length ? await db.select({ id: prizes.id }).from(prizes).where(and(eq(prizes.challengeId, challengeId), inArray(prizes.id, prizeIds))) : [];
  if (validPrizes.length !== prizeIds.length) throw invalid("Há prémios que não pertencem a este desafio.");

  const board = await reviewBoard(actor, challengeId);
  const sorted = [...placements].sort((a, b) => a.rank - b.rank);
  const names = sorted
    .map((p) => `${p.rank}.º ${board.rows.find((r) => r.submission.id === p.submissionId)!.project.name}${p.note ? ` (${p.note})` : ""}`)
    .join(", ");
  await db.transaction(async (tx) => {
    await tx.delete(results).where(eq(results.challengeId, challengeId));
    await tx.insert(results).values(
      sorted.map((p) => ({
        challengeId,
        submissionId: p.submissionId,
        rank: p.rank,
        finalScore: board.rows.find((r) => r.submission.id === p.submissionId)!.score,
        prizeId: p.prizeId,
        note: p.note,
        decidedById: actor.id,
      })),
    );
    await logDecision({ challengeId, actorId: actor.id, action: "results:confirmed", summary: `Resultados confirmados: ${names}.` }, tx);
  });
}

export async function publishResults(actor: User, challengeId: string) {
  assertInvestor(actor);
  const c = await loadChallenge(challengeId);
  if (c.status === "results_published") throw conflict("Os resultados já foram publicados.");
  const rows = await db
    .select({ rank: results.rank, projectName: projects.name, prizeTitle: prizes.title })
    .from(results)
    .innerJoin(submissions, eq(submissions.id, results.submissionId))
    .innerJoin(projects, eq(projects.id, submissions.projectId))
    .leftJoin(prizes, eq(prizes.id, results.prizeId))
    .where(eq(results.challengeId, challengeId))
    .orderBy(asc(results.rank));
  if (rows.length === 0) throw conflict("Confirme os resultados antes de os publicar.");
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(challenges)
      .set({ status: "results_published", resultsPublishedAt: new Date() })
      .where(and(eq(challenges.id, challengeId), eq(challenges.status, c.status)))
      .returning({ id: challenges.id });
    if (!updated.length) throw conflict("O estado do desafio mudou entretanto. Recarregue a página.");
    await tx.insert(posts).values({
      authorId: actor.id,
      kind: "announcement",
      title: `Resultados: ${c.title}`,
      body:
        `Os resultados do desafio “${c.title}” estão publicados.\n\n` +
        rows.map((r) => `${r.rank}.º lugar — ${r.projectName}${r.prizeTitle ? ` (${r.prizeTitle})` : ""}`).join("\n") +
        `\n\nObrigado a todas as equipas que submeteram. O feedback dos avaliadores está disponível para cada equipa.`,
      challengeId,
      pinned: true,
    });
    await logDecision({ challengeId, actorId: actor.id, action: "results:published", summary: `Resultados de “${c.title}” publicados e anunciados à comunidade.` }, tx);
  });
}

// ---------------------------------------------------------------------------
// Investment pipeline (separate from results)

const opportunityInput = z.object({
  projectId: z.string().refine(isUuid, "Seleccione um projecto."),
  challengeId: z.string().refine(isUuid).nullable().default(null),
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

export async function upsertOpportunity(actor: User, input: unknown, id?: string) {
  assertInvestor(actor);
  const v = parse(opportunityInput, input);
  const [project] = await db.select().from(projects).where(eq(projects.id, v.projectId)).limit(1);
  if (!project) throw invalid("Projecto não encontrado.");
  if (id) {
    const [before] = isUuid(id) ? await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1) : [];
    if (!before) throw notFound("Oportunidade não encontrada.");
    await db.transaction(async (tx) => {
      await tx.update(opportunities).set({ ...v, updatedAt: new Date() }).where(eq(opportunities.id, id));
      if (before.status !== v.status)
        await logDecision({ challengeId: v.challengeId, actorId: actor.id, action: "opportunity:status", summary: `Oportunidade “${project.name}”: ${OPPORTUNITY_LABEL[before.status]} → ${OPPORTUNITY_LABEL[v.status]}.` }, tx);
    });
    return id;
  }
  return db.transaction(async (tx) => {
    const [o] = await tx.insert(opportunities).values({ ...v, createdById: actor.id }).returning();
    await logDecision({ challengeId: v.challengeId, actorId: actor.id, action: "opportunity:created", summary: `Oportunidade de investimento registada para “${project.name}” (${OPPORTUNITY_LABEL[v.status]}).` }, tx);
    return o.id;
  });
}

export async function listOpportunities(actor: User) {
  assertInvestor(actor);
  return db
    .select({ o: opportunities, projectName: projects.name, projectSlug: projects.slug, projectTagline: projects.tagline, projectLogoHue: projects.logoHue, projectLogoFileId: projects.logoFileId, projectStage: projects.stage, challengeTitle: challenges.title })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .leftJoin(challenges, eq(challenges.id, opportunities.challengeId))
    .orderBy(asc(opportunities.createdAt));
}

/** Feedback visible to the submitting team once results are published (anonymised). */
export async function feedbackForTeam(viewer: User, submissionId: string) {
  if (!isUuid(submissionId)) return [];
  const [s] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
  if (!s) return [];
  const c = await loadChallenge(s.challengeId);
  const [member] = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, s.projectId), eq(projectMembers.userId, viewer.id))).limit(1);
  if (!member || c.status !== "results_published") return [];
  const rows = await db.select({ feedback: evaluations.feedback }).from(evaluations).where(eq(evaluations.submissionId, submissionId));
  return rows.filter((e) => e.feedback);
}
