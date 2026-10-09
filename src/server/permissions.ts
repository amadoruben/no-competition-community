import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluatorAssignments, projectMembers, projects, type User } from "@/db/schema";
import { forbidden } from "./errors";

export const isInvestor = (u: Pick<User, "role"> | null | undefined) => u?.role === "investor";

export async function isAssignedEvaluator(userId: string, challengeId: string) {
  const rows = await db
    .select({ x: evaluatorAssignments.evaluatorId })
    .from(evaluatorAssignments)
    .where(and(eq(evaluatorAssignments.challengeId, challengeId), eq(evaluatorAssignments.evaluatorId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** Investor, or an evaluator assigned to this challenge. */
export async function canReview(user: User, challengeId: string) {
  return isInvestor(user) || (user.role === "evaluator" && (await isAssignedEvaluator(user.id, challengeId)));
}

export async function isProjectMember(userId: string, projectId: string) {
  const owner = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, userId))).limit(1);
  if (owner.length) return true;
  const member = await db
    .select({ x: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return member.length > 0;
}

export function assertInvestor(user: User) {
  if (!isInvestor(user)) throw forbidden("Apenas o investidor pode realizar esta acção.");
}
