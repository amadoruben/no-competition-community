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
import { parse, text } from "./validation";

const visibleTo = (viewer: User) => (isInvestor(viewer) ? undefined : ne(challenges.status, "draft"));

export interface ChallengeCard extends Challenge {
  participantCount: number;
  submissionCount: number;
  topPrize: { title: string; value: string } | null;
  viewerEnrolled: boolean;
  viewerSubmitted: boolean;
}

export function listChallenges(viewer: User): ChallengeCard[] {
  const rows = db
    .select({
      c: challenges,
      participantCount: sql<number>`(select count(*) from ${participations} p where p.challenge_id = "challenges"."id")`,
      submissionCount: sql<number>`(select count(*) from ${submissions} s where s.challenge_id = "challenges"."id")`,
      viewerEnrolled: sql<number>`exists(select 1 from ${participations} p where p.challenge_id = "challenges"."id" and p.user_id = ${viewer.id})`,
      viewerSubmitted: sql<number>`exists(select 1 from ${submissions} s join ${participations} p on p.project_id = s.project_id and p.challenge_id = s.challenge_id where s.challenge_id = "challenges"."id" and p.user_id = ${viewer.id})`,
    })
    .from(challenges)
    .where(visibleTo(viewer))
    .orderBy(asc(challenges.submissionDeadline))
    .all();
  const prizeRows = rows.length
    ? db.select().from(prizes).where(inArray(prizes.challengeId, rows.map((r) => r.c.id))).orderBy(asc(prizes.position)).all()
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

export function getChallengeBySlug(slug: string, viewer: User) {
  const c = db.select().from(challenges).where(and(eq(challenges.slug, slug), visibleTo(viewer))).get();
  if (!c) throw notFound("Desafio não encontrado.");
  return challengeDetail(c, viewer);
}

function challengeDetail(c: Challenge, viewer: User) {
  const crit = db.select().from(criteria).where(eq(criteria.challengeId, c.id)).orderBy(asc(criteria.position)).all();
  const prz = db.select().from(prizes).where(eq(prizes.challengeId, c.id)).orderBy(asc(prizes.position)).all();
  const reviewer = canReview(viewer, c.id);

  const participants = db
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
      projectStage: projects.stage,
      enrolledAt: participations.createdAt,
    })
    .from(participations)
    .innerJoin(users, eq(users.id, participations.userId))
    .leftJoin(projects, eq(projects.id, participations.projectId))
    .where(eq(participations.challengeId, c.id))
    .orderBy(asc(participations.createdAt))
    .all();

  const viewerParticipation = db
    .select()
    .from(participations)
    .where(and(eq(participations.challengeId, c.id), eq(participations.userId, viewer.id)))
    .get();
  const viewerSubmission = viewerParticipation?.projectId
    ? db
        .select({ s: submissions, projectName: projects.name, projectSlug: projects.slug })
        .from(submissions)
        .innerJoin(projects, eq(projects.id, submissions.projectId))
        .where(and(eq(submissions.challengeId, c.id), eq(submissions.projectId, viewerParticipation.projectId)))
        .get()
    : undefined;

  const submittedProjectIds = new Set(
    db.select({ p: submissions.projectId }).from(submissions).where(eq(submissions.challengeId, c.id)).all().map((r) => r.p),
  );

  const published = c.status === "results_published";
  const finalResults =
    published || reviewer
      ? db
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
          })
          .from(results)
          .innerJoin(submissions, eq(submissions.id, results.submissionId))
          .innerJoin(projects, eq(projects.id, submissions.projectId))
          .leftJoin(prizes, eq(prizes.id, results.prizeId))
          .where(eq(results.challengeId, c.id))
          .orderBy(asc(results.rank))
          .all()
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

export type ChallengeDetail = ReturnType<typeof challengeDetail>;

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

function uniqueSlug(title: string, excludeId?: string) {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = db.select({ id: challenges.id }).from(challenges).where(eq(challenges.slug, slug)).get();
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export function createChallenge(actor: User, input: unknown) {
  assertInvestor(actor);
  const v = parse(challengeInput, input);
  return db.transaction((tx) => {
    const c = tx
      .insert(challenges)
      .values({
        slug: uniqueSlug(v.title),
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
      .returning()
      .get();
    v.criteria.forEach((cr, i) =>
      tx.insert(criteria).values({ challengeId: c.id, name: cr.name, description: cr.description, weight: cr.weight, position: i }).run(),
    );
    v.prizes.forEach((p, i) =>
      tx.insert(prizes).values({ challengeId: c.id, rank: p.rank, title: p.title, description: p.description, value: p.value, kind: p.kind, position: i }).run(),
    );
    tx.insert(evaluatorAssignments).values({ challengeId: c.id, evaluatorId: actor.id }).onConflictDoNothing().run();
    logDecision({ challengeId: c.id, actorId: actor.id, action: "created", summary: `Desafio “${c.title}” criado como rascunho.` });
    return c;
  });
}

export function updateChallenge(actor: User, id: string, input: unknown) {
  assertInvestor(actor);
  const current = db.select().from(challenges).where(eq(challenges.id, id)).get();
  if (!current) throw notFound("Desafio não encontrado.");
  if (current.status === "results_published") throw conflict("Os resultados já foram publicados; o desafio não pode ser editado.");
  const v = parse(challengeInput, input);

  const existingCriteria = db.select().from(criteria).where(eq(criteria.challengeId, id)).all();
  const hasEvaluations = !!db
    .select({ x: evaluations.id })
    .from(evaluations)
    .innerJoin(submissions, eq(submissions.id, evaluations.submissionId))
    .where(eq(submissions.challengeId, id))
    .get();
  const keptIds = new Set(v.criteria.map((c) => c.id).filter(Boolean));
  if (hasEvaluations) {
    const structural =
      v.criteria.some((c) => !c.id || !existingCriteria.some((e) => e.id === c.id)) ||
      existingCriteria.some((e) => !keptIds.has(e.id));
    if (structural)
      throw invalid("Já existem avaliações: pode ajustar nomes e pesos, mas não adicionar ou remover critérios.", {
        criteria: "Critérios bloqueados após a primeira avaliação.",
      });
  }

  db.transaction((tx) => {
    tx.update(challenges)
      .set({
        slug: current.title === v.title ? current.slug : uniqueSlug(v.title, id),
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
      .where(eq(challenges.id, id))
      .run();

    for (const e of existingCriteria) if (!keptIds.has(e.id)) tx.delete(criteria).where(eq(criteria.id, e.id)).run();
    v.criteria.forEach((cr, i) => {
      const values = { name: cr.name, description: cr.description, weight: cr.weight, position: i };
      if (cr.id && existingCriteria.some((e) => e.id === cr.id)) tx.update(criteria).set(values).where(eq(criteria.id, cr.id)).run();
      else tx.insert(criteria).values({ ...values, challengeId: id }).run();
    });

    const existingPrizes = db.select().from(prizes).where(eq(prizes.challengeId, id)).all();
    const keptPrizes = new Set(v.prizes.map((p) => p.id).filter(Boolean));
    for (const p of existingPrizes) if (!keptPrizes.has(p.id)) tx.delete(prizes).where(eq(prizes.id, p.id)).run();
    v.prizes.forEach((p, i) => {
      const values = { rank: p.rank, title: p.title, description: p.description, value: p.value, kind: p.kind, position: i };
      if (p.id && existingPrizes.some((e) => e.id === p.id)) tx.update(prizes).set(values).where(eq(prizes.id, p.id)).run();
      else tx.insert(prizes).values({ ...values, challengeId: id }).run();
    });
    logDecision({ challengeId: id, actorId: actor.id, action: "edited", summary: "Detalhes, critérios ou prémios actualizados." });
  });
  return db.select().from(challenges).where(eq(challenges.id, id)).get()!;
}

const ACTION_LABEL: Partial<Record<ChallengeStatus, string>> = {
  published: "publicado",
  paused: "colocado em pausa",
  closed: "encerrado para submissões",
};

export function setChallengeStatus(actor: User, id: string, to: unknown) {
  assertInvestor(actor);
  const status = parse(z.enum(CHALLENGE_STATUSES), to);
  const c = db.select().from(challenges).where(eq(challenges.id, id)).get();
  if (!c) throw notFound("Desafio não encontrado.");
  if (status === "results_published") throw invalid("Use “Publicar resultados” para concluir o desafio.");
  if (!canTransition(c.status, status))
    throw conflict(`Não é possível passar de “${STATUS_LABEL[c.status]}” para “${STATUS_LABEL[status]}”.`);
  if (status === "published") {
    const n = db.select({ n: sql<number>`count(*)` }).from(criteria).where(eq(criteria.challengeId, id)).get()!.n;
    if (n === 0) throw invalid("Defina critérios de avaliação antes de publicar.");
  }
  db.update(challenges)
    .set({ status, publishedAt: status === "published" && !c.publishedAt ? new Date() : c.publishedAt })
    .where(eq(challenges.id, id))
    .run();
  logDecision({
    challengeId: id,
    actorId: actor.id,
    action: `status:${status}`,
    summary: `Desafio “${c.title}” ${ACTION_LABEL[status] ?? status}${c.status === "closed" && status === "published" ? " (submissões reabertas)" : ""}.`,
  });
}

export function setEvaluator(actor: User, challengeId: string, evaluatorId: string, assigned: boolean) {
  assertInvestor(actor);
  const ev = db.select().from(users).where(eq(users.id, evaluatorId)).get();
  if (!ev || (ev.role !== "evaluator" && ev.role !== "investor")) throw invalid("Seleccione um avaliador válido.");
  if (assigned) {
    db.insert(evaluatorAssignments).values({ challengeId, evaluatorId }).onConflictDoNothing().run();
    logDecision({ challengeId, actorId: actor.id, action: "evaluator:add", summary: `${ev.name} atribuído(a) como avaliador(a).` });
  } else {
    db.delete(evaluatorAssignments)
      .where(and(eq(evaluatorAssignments.challengeId, challengeId), eq(evaluatorAssignments.evaluatorId, evaluatorId)))
      .run();
    logDecision({ challengeId, actorId: actor.id, action: "evaluator:remove", summary: `${ev.name} removido(a) da avaliação.` });
  }
}

export function getChallengeForEdit(actor: User, id: string) {
  assertInvestor(actor);
  const c = db.select().from(challenges).where(eq(challenges.id, id)).get();
  if (!c) throw notFound("Desafio não encontrado.");
  return {
    challenge: c,
    criteria: db.select().from(criteria).where(eq(criteria.challengeId, id)).orderBy(asc(criteria.position)).all(),
    prizes: db.select().from(prizes).where(eq(prizes.challengeId, id)).orderBy(asc(prizes.position)).all(),
  };
}

/** Public, anonymous overview for the landing page. Published challenges only. */
export function publicOverview() {
  const open = db
    .select()
    .from(challenges)
    .where(ne(challenges.status, "draft"))
    .orderBy(asc(challenges.submissionDeadline))
    .all();
  const prizeRows = db.select().from(prizes).all();
  const count = (t: typeof projects | typeof users | typeof submissions) => db.select({ n: sql<number>`count(*)` }).from(t).get()!.n;
  return {
    challenges: open
      .filter((c) => ["open", "upcoming"].includes(challengePhase(c)))
      .slice(0, 3)
      .map((c) => ({ ...c, phase: challengePhase(c), topPrize: prizeRows.find((p) => p.challengeId === c.id && p.position === 0) ?? null })),
    stats: {
      challenges: open.length,
      projects: count(projects),
      members: db.select({ n: sql<number>`count(*)` }).from(users).where(eq(users.role, "member")).get()!.n,
      submissions: count(submissions),
    },
  };
}
