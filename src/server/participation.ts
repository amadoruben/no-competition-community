import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challenges, participations, projectMembers, projects, submissions, type User } from "@/db/schema";
import { canEnroll, canSubmit, challengePhase, PHASE_LABEL } from "@/lib/challenge-state";
import { conflict, forbidden, invalid, notFound } from "./errors";
import { isProjectMember } from "./permissions";
import { isUuid, optionalUrl, parse, text } from "./validation";

async function loadChallenge(id: string) {
  const [c] = isUuid(id) ? await db.select().from(challenges).where(eq(challenges.id, id)).limit(1) : [];
  if (!c || c.status === "draft") throw notFound("Desafio não encontrado.");
  return c;
}

export async function enroll(actor: User, challengeId: string) {
  if (actor.role !== "member") throw forbidden("Apenas membros podem participar em desafios.");
  const c = await loadChallenge(challengeId);
  if (!canEnroll(c)) throw conflict(`As inscrições não estão abertas (${PHASE_LABEL[challengePhase(c)].toLowerCase()}).`);
  // Idempotent: the unique (challenge, user) index absorbs double submits.
  await db.insert(participations).values({ challengeId, userId: actor.id }).onConflictDoNothing();
  const [p] = await db
    .select()
    .from(participations)
    .where(and(eq(participations.challengeId, challengeId), eq(participations.userId, actor.id)))
    .limit(1);
  return p;
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
export async function submitProject(actor: User, challengeId: string, input: unknown) {
  if (actor.role !== "member") throw forbidden("Apenas membros podem submeter projectos.");
  const c = await loadChallenge(challengeId);
  if (!canSubmit(c)) throw conflict(`As submissões estão fechadas (${PHASE_LABEL[challengePhase(c)].toLowerCase()}).`);
  const v = parse(submissionInput, input);

  const [project] = isUuid(v.projectId) ? await db.select().from(projects).where(eq(projects.id, v.projectId)).limit(1) : [];
  if (!project) throw invalid("Projecto inválido.", { projectId: "Projecto não encontrado." });
  if (!(await isProjectMember(actor.id, project.id))) throw forbidden("Só pode submeter projectos de que faz parte.");
  const [{ n: teamSize }] = await db.select({ n: count() }).from(projectMembers).where(eq(projectMembers.projectId, project.id));
  if (teamSize > c.maxTeamSize)
    throw invalid(`A equipa tem ${teamSize} pessoas; este desafio permite no máximo ${c.maxTeamSize}.`, { projectId: "Equipa demasiado grande." });

  const [participation] = await db
    .select()
    .from(participations)
    .where(and(eq(participations.challengeId, challengeId), eq(participations.userId, actor.id)))
    .limit(1);
  if (participation?.projectId && participation.projectId !== project.id) {
    const [other] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.challengeId, challengeId), eq(submissions.projectId, participation.projectId)))
      .limit(1);
    if (other) throw conflict("Já submeteu outro projecto a este desafio.");
  }

  const values = { summary: v.summary, details: v.details, deliverableUrl: v.deliverableUrl!, videoUrl: v.videoUrl };
  return db.transaction(async (tx) => {
    await tx
      .insert(participations)
      .values({ challengeId, userId: actor.id, projectId: project.id })
      .onConflictDoUpdate({ target: [participations.challengeId, participations.userId], set: { projectId: project.id } });
    // Upsert on (challenge, project): a teammate submitting again updates the same entry.
    const [existing] = await tx
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.challengeId, challengeId), eq(submissions.projectId, project.id)))
      .limit(1);
    const [submission] = await tx
      .insert(submissions)
      .values({ ...values, challengeId, projectId: project.id, submittedById: actor.id })
      .onConflictDoUpdate({ target: [submissions.challengeId, submissions.projectId], set: { ...values, updatedAt: new Date() } })
      .returning();
    return { submission, updated: !!existing };
  });
}
