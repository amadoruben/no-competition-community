import { desc, eq } from "drizzle-orm";
import { db, type DB } from "@/db";
import { challenges, decisionLog, users } from "@/db/schema";

type Tx = Pick<DB, "insert">;

/** Append to the decision history. Pass the transaction to log atomically with the change. */
export async function logDecision(
  entry: { challengeId?: string | null; actorId: string; action: string; summary: string },
  tx: Tx = db,
) {
  await tx.insert(decisionLog).values({ challengeId: entry.challengeId ?? null, actorId: entry.actorId, action: entry.action, summary: entry.summary });
}

export async function decisionHistory(challengeId?: string, limit = 50) {
  const q = db
    .select({
      id: decisionLog.id,
      action: decisionLog.action,
      summary: decisionLog.summary,
      createdAt: decisionLog.createdAt,
      challengeId: decisionLog.challengeId,
      challengeTitle: challenges.title,
      actorName: users.name,
    })
    .from(decisionLog)
    .innerJoin(users, eq(users.id, decisionLog.actorId))
    .leftJoin(challenges, eq(challenges.id, decisionLog.challengeId))
    .orderBy(desc(decisionLog.createdAt))
    .limit(limit)
    .$dynamic();
  return challengeId ? q.where(eq(decisionLog.challengeId, challengeId)) : q;
}

export type HistoryEntry = Awaited<ReturnType<typeof decisionHistory>>[number];
