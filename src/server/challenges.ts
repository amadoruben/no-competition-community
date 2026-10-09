import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  challenges,
  CHALLENGE_STATUSES,
  criteria,
  evaluations,
  evaluatorAssignments,
  participations,
  PRIZE_KINDS,
  prizes,
  projects,
  results,
  submissions,
  users,
  type Challenge,
  type ChallengeStatus,
  type User,
} from "@/db/schema";
import { canEnroll, canSubmit, canTransition, challengePhase, STATUS_LABEL } from "@/lib/challenge-state";
import { slugify } from "@/lib/slug";
import { conflict, invalid, notFound } from "./errors";
import { logDecision } from "./log";
import { assertInvestor, canReview, isInvestor } from "./permissions";
import { isUuid, parse, text } from "./validation";

const visibleTo = (viewer: User) => (isInvestor(viewer) ? undefined : ne(challenges.status, "draft"));
const count = sql<number>`count(*)::int`;

export interface ChallengeCard extends Challenge {
  participantCount: number;
  submissionCount: number;
  topPrize: { title: string; value: string } | null;
  viewerEnrolled: boolean;
  viewerSubmitted: boolean;
}

export async function listChallenges(viewer: User): Promise<ChallengeCard[]> {
  const rows = await db
    .select({
      c: challenges,
      participantCount: sql<number>`(select count(*)::int from ${participations} p where p.challenge_id = "challenges"."id")`,
      submissionCount: sql<number>`(select count(*)::int from ${submissions} s where s.challenge_id = "challenges"."id")`,
      viewerEnrolled: sql<boolean>`exists(select 1 from ${participations} p where p.challenge_id = "challenges"."id" and p.user_id = ${viewer.id})`,
      viewerSubmitted: sql<boolean>`exists(select 1 from ${submissions} s join ${participations} p on p.project_id = s.project_id and p.challenge_id = s.challenge_id where s.challenge_id = "challenges"."id" and p.user_id = ${viewer.id})`,
    })
    .from(challenges)
    .where(visibleTo(viewer))
    .orderBy(asc(challenges.submissionDeadline));
  const prizeRows = rows.length
    ? await db.select().from(prizes).where(inArray(prizes.challengeId, rows.map((r) => r.c.id))).orderBy(asc(prizes.position))
    : [];
  return rows.map((r) => {
    const top = prizeRows.find((p) => p.challengeId === r.c.id);
    return {
      ...r.c,
      participantCount: r.participantCount,
      submissionCount: r.submissionCount,
      viewerEnrolled: !!r.viewerEnrolled,
      viewerSubmitted: !!r.viewerSubmitted,
      topPrize: top ? { title: top.title, value: top.value } : null,
    };
  });
}

export async function getChallengeBySlug(slug: string, viewer: User) {
  const [c] = await db.select().from(challenges).where(and(eq(challenges.slug, slug), visibleTo(viewer))).limit(1);
  if (!c) throw notFound("Desafio não encontrado.");
  return challengeDetail(c, viewer);
}

async function challengeDetail(c: Challenge, viewer: User) {
  const [crit, prz, reviewer, participants, [viewerParticipation], submitted] = await Promise.all([
    db.select().from(criteria).where(eq(criteria.challengeId, c.id)).orderBy(asc(criteria.position)),
    db.select().from(prizes).where(eq(prizes.challengeId, c.id)).orderBy(asc(prizes.position)),
    canReview(viewer, c.id),
    db
      .select({
        userId: users.id,
        name: users.name,
        handle: users.handle,
        headline: users.headline,
        avatarHue: users.avatarHue,
        projectId: projects.id,
        projectName: projects.name,
        projectSlug: projects.slug,
        projectTagline: projects.tagline,
        projectLogoHue: projects.logoHue,
        projectLogoFileId: projects.logoFileId,
        projectStage: projects.stage,
        enrolledAt: participations.createdAt,
      })
      .from(participations)
      .innerJoin(users, eq(users.id, participations.userId))
      .leftJoin(projects, eq(projects.id, participations.projectId))
      .where(eq(participations.challengeId, c.id))
      .orderBy(asc(participations.createdAt)),
    db.select().from(participations).where(and(eq(participations.challengeId, c.id), eq(participations.userId, viewer.id))).limit(1),
    db.select({ p: submissions.projectId }).from(submissions).where(eq(submissions.challengeId, c.id)),
  ]);
  const [viewerSubmission] = viewerParticipation?.projectId
    ? await db
        .select({ s: submissions, projectName: projects.name, projectSlug: projects.slug })
        .from(submissions)
        .innerJoin(projects, eq(projects.id, submissions.projectId))
        .where(and(eq(submissions.challengeId, c.id), eq(submissions.projectId, viewerParticipation.projectId)))
        .limit(1)
    : [];
  const submittedProjectIds = new Set(submitted.map((r) => r.p));

  const published = c.status === "results_published";
  // Confirmed results stay confidential to the investor until publication.
  const finalResults =
    published || isInvestor(viewer)
      ? await db
          .select({
            rank: results.rank,
            finalScore: results.finalScore,
            note: results.note,
            prizeTitle: prizes.title,
            prizeValue: prizes.value,
            prizeKind: prizes.kind,
            projectName: projects.name,
            projectSlug: projects.slug,
            projectTagline: projects.tagline,
            projectLogoHue: projects.logoHue,
            projectLogoFileId: projects.logoFileId,
          })
          .from(results)
          .innerJoin(submissions, eq(submissions.id, results.submissionId))
          .innerJoin(projects, eq(projects.id, submissions.projectId))
          .leftJoin(prizes, eq(prizes.id, results.prizeId))
          .where(eq(results.challengeId, c.id))
          .orderBy(asc(results.rank))
      : [];

  const visibleParticipants = c.participantsVisible || reviewer ? participants : [];
  return {
    challenge: c,
    phase: challengePhase(c),
    criteria: crit,
    prizes: prz,
    participantCount: participants.length,
    submissionCount: submittedProjectIds.size,
    participants: visibleParticipants.map((p) => ({ ...p, submitted: !!p.projectId && submittedProjectIds.has(p.projectId) })),
    viewerParticipation: viewerParticipation ?? null,
    viewerSubmission: viewerSubmission ?? null,
    results: finalResults,
    resultsPublished: published,
    canEnroll: viewer.role === "member" && !viewerParticipation && canEnroll(c),
    canSubmit: viewer.role === "member" && canSubmit(c),
    isReviewer: reviewer,
  };
}

export type ChallengeDetail = Awaited<ReturnType<typeof challengeDetail>>;

// ---------------------------------------------------------------------------
// Investor mutations

const lines = (label: string, max: number) =>
  z
    .array(z.string().trim().min(1).max(400))
    .max(max, `${label}: máximo ${max} itens.`);

const challengeInput = z
  .object({
    title: text(4, 100, "Título"),
    tagline: text(10, 180, "Resumo"),
    description: text(20, 6000, "Descrição"),
    category: text(2, 40, "Categoria"),
    objectives: lines("Objectivos", 12).min(1, "Indique pelo menos um objectivo."),
    rules: lines("Regras", 20).min(1, "Indique pelo menos uma regra."),
    submissionInstructions: text(10, 3000, "Instruções de submissão"),
    startsAt: z.coerce.date({ message: "Data de início inválida." }),
    submissionDeadline: z.coerce.date({ message: "Prazo de submissão inválido." }),
    resultsDate: z.coerce.date({ message: "Data de resultados inválida." }),
    maxTeamSize: z.coerce.number().int().min(1, "Mínimo 1 pessoa.").max(20, "Máximo 20 pessoas."),
    placementPoints: z.array(z.coerce.number().int().min(0).max(5000)).max(10),
    participantsVisible: z.boolean(),
    coverHue: z.coerce.number().int().min(0).max(360),
    criteria: z
      .array(
        z.object({
          id: z.string().optional(),
          name: text(2, 60, "Nome do critério"),
          description: z.string().trim().max(300).default(""),
          weight: z.coerce.number().int().min(1, "Peso mínimo 1.").max(10, "Peso máximo 10."),
        }),
      )
      .min(1, "Defina pelo menos um critério de avaliação.")
      .max(10, "Máximo 10 critérios."),
    prizes: z
      .array(
        z.object({
          id: z.string().optional(),
          rank: z.coerce.number().int().min(1).max(10).nullable(),
          title: text(2, 80, "Título do prémio"),
          description: z.string().trim().max(400).default(""),
          value: z.string().trim().max(120).default(""),
          kind: z.enum(PRIZE_KINDS),
        }),
      )
      .max(10),
  })
  .superRefine((v, ctx) => {
    if (v.submissionDeadline <= v.startsAt)
      ctx.addIssue({ code: "custom", path: ["submissionDeadline"], message: "O prazo deve ser posterior ao início." });
    if (v.resultsDate < v.submissionDeadline)
      ctx.addIssue({ code: "custom", path: ["resultsDate"], message: "Os resultados não podem ser anteriores ao prazo." });
  });

export type ChallengeInput = z.input<typeof challengeInput>;

async function uniqueSlug(title: string, excludeId?: string) {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; ; i++) {
    const [hit] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.slug, slug)).limit(1);
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

async function loadForInvestor(actor: User, id: string) {
  assertInvestor(actor);
  if (!isUuid(id)) throw notFound("Desafio não encontrado.");
  const [c] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
  if (!c) throw notFound("Desafio não encontrado.");
  return c;
}

export async function createChallenge(actor: User, input: unknown) {
  assertInvestor(actor);
  const v = parse(challengeInput, input);
  const slug = await uniqueSlug(v.title);
  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(challenges)
      .values({
        slug,
        title: v.title,
        tagline: v.tagline,
        description: v.description,
        category: v.category,
        objectives: v.objectives,
        rules: v.rules,
        submissionInstructions: v.submissionInstructions,
        startsAt: v.startsAt,
        submissionDeadline: v.submissionDeadline,
        resultsDate: v.resultsDate,
        maxTeamSize: v.maxTeamSize,
        placementPoints: v.placementPoints,
        participantsVisible: v.participantsVisible,
        coverHue: v.coverHue,
        createdById: actor.id,
        status: "draft",
      })
      .returning();
    await tx.insert(criteria).values(v.criteria.map((cr, i) => ({ challengeId: c.id, name: cr.name, description: cr.description, weight: cr.weight, position: i })));
    if (v.prizes.length)
      await tx.insert(prizes).values(v.prizes.map((p, i) => ({ challengeId: c.id, rank: p.rank, title: p.title, description: p.description, value: p.value, kind: p.kind, position: i })));
    await tx.insert(evaluatorAssignments).values({ challengeId: c.id, evaluatorId: actor.id }).onConflictDoNothing();
    await logDecision({ challengeId: c.id, actorId: actor.id, action: "created", summary: `Desafio “${c.title}” criado como rascunho.` }, tx);
    return c;
  });
}

export async function updateChallenge(actor: User, id: string, input: unknown) {
  const current = await loadForInvestor(actor, id);
  if (current.status === "results_published") throw conflict("Os resultados já foram publicados; o desafio não pode ser editado.");
  const v = parse(challengeInput, input);

  const [existingCriteria, existingPrizes, evaluated] = await Promise.all([
    db.select().from(criteria).where(eq(criteria.challengeId, id)),
    db.select().from(prizes).where(eq(prizes.challengeId, id)),
    db
      .select({ x: evaluations.id })
      .from(evaluations)
      .innerJoin(submissions, eq(submissions.id, evaluations.submissionId))
      .where(eq(submissions.challengeId, id))
      .limit(1),
  ]);
  const keptIds = new Set(v.criteria.map((c) => c.id).filter(Boolean));
  if (evaluated.length) {
    const structural =
      v.criteria.some((c) => !c.id || !existingCriteria.some((e) => e.id === c.id)) ||
      existingCriteria.some((e) => !keptIds.has(e.id));
    if (structural)
      throw invalid("Já existem avaliações: pode ajustar nomes e pesos, mas não adicionar ou remover critérios.", {
        criteria: "Critérios bloqueados após a primeira avaliação.",
      });
  }
  const slug = current.title === v.title ? current.slug : await uniqueSlug(v.title, id);

  await db.transaction(async (tx) => {
    await tx
      .update(challenges)
      .set({
        slug,
        title: v.title,
        tagline: v.tagline,
        description: v.description,
        category: v.category,
        objectives: v.objectives,
        rules: v.rules,
        submissionInstructions: v.submissionInstructions,
        startsAt: v.startsAt,
        submissionDeadline: v.submissionDeadline,
        resultsDate: v.resultsDate,
        maxTeamSize: v.maxTeamSize,
        placementPoints: v.placementPoints,
        participantsVisible: v.participantsVisible,
        coverHue: v.coverHue,
      })
      .where(eq(challenges.id, id));

    for (const e of existingCriteria) if (!keptIds.has(e.id)) await tx.delete(criteria).where(eq(criteria.id, e.id));
    for (const [i, cr] of v.criteria.entries()) {
      const values = { name: cr.name, description: cr.description, weight: cr.weight, position: i };
      if (cr.id && existingCriteria.some((e) => e.id === cr.id)) await tx.update(criteria).set(values).where(eq(criteria.id, cr.id));
      else await tx.insert(criteria).values({ ...values, challengeId: id });
    }

    const keptPrizes = new Set(v.prizes.map((p) => p.id).filter(Boolean));
    for (const p of existingPrizes) if (!keptPrizes.has(p.id)) await tx.delete(prizes).where(eq(prizes.id, p.id));
    for (const [i, p] of v.prizes.entries()) {
      const values = { rank: p.rank, title: p.title, description: p.description, value: p.value, kind: p.kind, position: i };
      if (p.id && existingPrizes.some((e) => e.id === p.id)) await tx.update(prizes).set(values).where(eq(prizes.id, p.id));
      else await tx.insert(prizes).values({ ...values, challengeId: id });
    }
    await logDecision({ challengeId: id, actorId: actor.id, action: "edited", summary: `Desafio “${v.title}”: detalhes, critérios ou prémios actualizados.` }, tx);
  });
  const [updated] = await db.select().from(challenges).where(eq(challenges.id, id));
  return updated;
}

const ACTION_LABEL: Partial<Record<ChallengeStatus, string>> = {
  published: "publicado",
  paused: "colocado em pausa",
  closed: "encerrado para submissões",
};

export async function setChallengeStatus(actor: User, id: string, to: unknown) {
  const c = await loadForInvestor(actor, id);
  const status = parse(z.enum(CHALLENGE_STATUSES), to);
  if (status === "results_published") throw invalid("Use “Publicar resultados” para concluir o desafio.");
  if (!canTransition(c.status, status))
    throw conflict(`Não é possível passar de “${STATUS_LABEL[c.status]}” para “${STATUS_LABEL[status]}”.`);
  if (status === "published") {
    const [{ n }] = await db.select({ n: count }).from(criteria).where(eq(criteria.challengeId, id));
    if (n === 0) throw invalid("Defina critérios de avaliação antes de publicar.");
  }
  await db.transaction(async (tx) => {
    // Guard against a concurrent transition: only update from the status we validated.
    const updated = await tx
      .update(challenges)
      .set({ status, publishedAt: status === "published" && !c.publishedAt ? new Date() : c.publishedAt })
      .where(and(eq(challenges.id, id), eq(challenges.status, c.status)))
      .returning({ id: challenges.id });
    if (!updated.length) throw conflict("O estado do desafio mudou entretanto. Recarregue a página.");
    await logDecision(
      {
        challengeId: id,
        actorId: actor.id,
        action: `status:${status}`,
        summary: `Desafio “${c.title}” ${ACTION_LABEL[status] ?? status}${c.status === "closed" && status === "published" ? " (submissões reabertas)" : ""}.`,
      },
      tx,
    );
  });
}

export async function setEvaluator(actor: User, challengeId: string, evaluatorId: string, assigned: boolean) {
  await loadForInvestor(actor, challengeId);
  const [ev] = isUuid(evaluatorId) ? await db.select().from(users).where(eq(users.id, evaluatorId)).limit(1) : [];
  if (!ev || (ev.role !== "evaluator" && ev.role !== "investor")) throw invalid("Seleccione um avaliador válido.");
  await db.transaction(async (tx) => {
    if (assigned) {
      await tx.insert(evaluatorAssignments).values({ challengeId, evaluatorId }).onConflictDoNothing();
      await logDecision({ challengeId, actorId: actor.id, action: "evaluator:add", summary: `${ev.name} atribuído(a) como avaliador(a).` }, tx);
    } else {
      await tx
        .delete(evaluatorAssignments)
        .where(and(eq(evaluatorAssignments.challengeId, challengeId), eq(evaluatorAssignments.evaluatorId, evaluatorId)));
      await logDecision({ challengeId, actorId: actor.id, action: "evaluator:remove", summary: `${ev.name} removido(a) da avaliação.` }, tx);
    }
  });
}

export async function getChallengeForEdit(actor: User, id: string) {
  const c = await loadForInvestor(actor, id);
  const [crit, prz] = await Promise.all([
    db.select().from(criteria).where(eq(criteria.challengeId, id)).orderBy(asc(criteria.position)),
    db.select().from(prizes).where(eq(prizes.challengeId, id)).orderBy(asc(prizes.position)),
  ]);
  return { challenge: c, criteria: crit, prizes: prz };
}

/** Public, anonymous overview for the landing page. Published challenges only. */
export async function publicOverview() {
  const [open, prizeRows, [p], [m], [s]] = await Promise.all([
    db.select().from(challenges).where(ne(challenges.status, "draft")).orderBy(asc(challenges.submissionDeadline)),
    db.select().from(prizes).where(eq(prizes.position, 0)),
    db.select({ n: count }).from(projects),
    db.select({ n: count }).from(users).where(eq(users.role, "member")),
    db.select({ n: count }).from(submissions),
  ]);
  return {
    challenges: open
      .filter((c) => ["open", "upcoming"].includes(challengePhase(c)))
      .slice(0, 3)
      .map((c) => ({ ...c, phase: challengePhase(c), topPrize: prizeRows.find((x) => x.challengeId === c.id) ?? null })),
    stats: { challenges: open.length, projects: p.n, members: m.n, submissions: s.n },
  };
}
