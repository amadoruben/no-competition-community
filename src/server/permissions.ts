import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluatorAssignments, projectMembers, projects, type User } from "@/db/schema";
import { forbidden } from "./errors";

export const isInvestor = (u: Pick<User, "role"> | null | undefined) => u?.role === "investor";

export function isAssignedEvaluator(userId: string, challengeId: string) {
  return !!db
    .select({ x: evaluatorAssignments.evaluatorId })
    .from(evaluatorAssignments)
    .where(and(eq(evaluatorAssignments.challengeId, challengeId), eq(evaluatorAssignments.evaluatorId, userId)))
    .get();
}

/** Investor, or an evaluator assigned to this challenge. */
export function canReview(user: User, challengeId: string) {
  return isInvestor(user) || (user.role === "evaluator" && isAssignedEvaluator(user.id, challengeId));
}

export function isProjectMember(userId: string, projectId: string) {
  const owner = db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, userId))).get();
  if (owner) return true;
  return !!db
    .select({ x: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .get();
}

export function assertInvestor(user: User) {
  if (!isInvestor(user)) throw forbidden("Apenas o investidor pode realizar esta acção.");
}
