import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { decisionLog, users } from "@/db/schema";

export function logDecision(entry: { challengeId?: string | null; actorId: string; action: string; summary: string }) {
  db.insert(decisionLog)
    .values({ challengeId: entry.challengeId ?? null, actorId: entry.actorId, action: entry.action, summary: entry.summary })
    .run();
}

export function decisionHistory(challengeId?: string, limit = 50) {
  const q = db
    .select({
      id: decisionLog.id,
      action: decisionLog.action,
      summary: decisionLog.summary,
      createdAt: decisionLog.createdAt,
      challengeId: decisionLog.challengeId,
      actorName: users.name,
    })
    .from(decisionLog)
    .innerJoin(users, eq(users.id, decisionLog.actorId))
    .orderBy(desc(decisionLog.createdAt))
    .limit(limit);
  return challengeId ? q.where(eq(decisionLog.challengeId, challengeId)).all() : q.all();
}
