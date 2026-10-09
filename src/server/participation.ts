import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challenges, participations, projectMembers, projects, submissions, type User } from "@/db/schema";
import { canEnroll, canSubmit, challengePhase, PHASE_LABEL } from "@/lib/challenge-state";
import { conflict, forbidden, invalid, notFound } from "./errors";
import { isProjectMember } from "./permissions";
import { optionalUrl, parse, text } from "./validation";

function loadChallenge(id: string) {
  const c = db.select().from(challenges).where(eq(challenges.id, id)).get();
  if (!c || c.status === "draft") throw notFound("Desafio não encontrado.");
  return c;
}

export function enroll(actor: User, challengeId: string) {
  if (actor.role !== "member") throw forbidden("Apenas membros podem participar em desafios.");
  const c = loadChallenge(challengeId);
  if (!canEnroll(c)) throw conflict(`As inscrições não estão abertas (${PHASE_LABEL[challengePhase(c)].toLowerCase()}).`);
  const existing = db
    .select()
    .from(participations)
    .where(and(eq(participations.challengeId, challengeId), eq(participations.userId, actor.id)))
    .get();
  if (existing) return existing;
  return db.insert(participations).values({ challengeId, userId: actor.id }).returning().get();
}

const submissionInput = z.object({
  projectId: z.string().min(1, "Seleccione o projecto a submeter."),
  summary: text(20, 400, "Resumo"),
  details: z.string().trim().max(6000).default(""),
  deliverableUrl: optionalUrl.refine((v) => v !== null, "Indique o link da entrega."),
  videoUrl: optionalUrl,
});

/**
 * Submit (or update, until the deadline) a project to a challenge.
 * Enrols the member automatically if they had not enrolled yet.
 */
export function submitProject(actor: User, challengeId: string, input: unknown) {
  if (actor.role !== "member") throw forbidden("Apenas membros podem submeter projectos.");
  const c = loadChallenge(challengeId);
  if (!canSubmit(c)) throw conflict(`As submissões estão fechadas (${PHASE_LABEL[challengePhase(c)].toLowerCase()}).`);
  const v = parse(submissionInput, input);

  const project = db.select().from(projects).where(eq(projects.id, v.projectId)).get();
  if (!project) throw invalid("Projecto inválido.", { projectId: "Projecto não encontrado." });
  if (!isProjectMember(actor.id, project.id))
    throw forbidden("Só pode submeter projectos de que faz parte.");
  const teamSize = db.select({ n: sql<number>`count(*)` }).from(projectMembers).where(eq(projectMembers.projectId, project.id)).get()!.n;
  if (teamSize > c.maxTeamSize)
    throw invalid(`A equipa tem ${teamSize} pessoas; este desafio permite no máximo ${c.maxTeamSize}.`, { projectId: "Equipa demasiado grande." });

  const participation = db
    .select()
    .from(participations)
    .where(and(eq(participations.challengeId, challengeId), eq(participations.userId, actor.id)))
    .get();
  if (participation?.projectId && participation.projectId !== project.id) {
    const other = db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.challengeId, challengeId), eq(submissions.projectId, participation.projectId)))
      .get();
    if (other) throw conflict("Já submeteu outro projecto a este desafio.");
  }

  return db.transaction((tx) => {
    if (participation) tx.update(participations).set({ projectId: project.id }).where(eq(participations.id, participation.id)).run();
    else tx.insert(participations).values({ challengeId, userId: actor.id, projectId: project.id }).run();

    const existing = tx
      .select()
      .from(submissions)
      .where(and(eq(submissions.challengeId, challengeId), eq(submissions.projectId, project.id)))
      .get();
    const values = {
      summary: v.summary,
      details: v.details,
      deliverableUrl: v.deliverableUrl!,
      videoUrl: v.videoUrl,
    };
    if (existing) {
      return { submission: tx.update(submissions).set({ ...values, updatedAt: new Date() }).where(eq(submissions.id, existing.id)).returning().get(), updated: true };
    }
    return {
      submission: tx.insert(submissions).values({ ...values, challengeId, projectId: project.id, submittedById: actor.id }).returning().get(),
      updated: false,
    };
  });
}
