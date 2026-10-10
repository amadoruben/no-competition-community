import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { ROLE_LABEL } from "@/lib/labels";
import { forbidden, invalid, notFound } from "./errors";
import { logDecision } from "./log";
import { assertInvestor } from "./permissions";

/** Roles an investor can grant from the web. Investors are only created by the operator (OWNER_EMAILS or npm run user:role). */
export const ASSIGNABLE_ROLES = ["member", "evaluator"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Everyone with an account, for the investor's "Membros e papéis" page. Demo and real accounts never mix. */
export async function listPeople(actor: User, opts: { q?: string } = {}) {
  assertInvestor(actor);
  const q = opts.q?.trim();
  const scope = eq(users.isDemo, actor.isDemo);
  const [rows, totals] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, handle: users.handle, role: users.role, avatarHue: users.avatarHue, avatarFileId: users.avatarFileId, createdAt: users.createdAt })
      .from(users)
      .where(q ? and(scope, or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))) : scope)
      .orderBy(sql`case ${users.role} when 'investor' then 0 when 'evaluator' then 1 else 2 end`, asc(users.name)),
    db.select({ role: users.role, n: sql<number>`count(*)::int` }).from(users).where(scope).groupBy(users.role),
  ]);
  const counts: Record<User["role"], number> = { investor: 0, evaluator: 0, member: 0 };
  for (const t of totals) counts[t.role] = t.n;
  return { rows, counts };
}

/** Promote a member to evaluator or back. Logged in the decision history. */
export async function changeRole(actor: User, userId: string, role: string) {
  assertInvestor(actor);
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) throw invalid("Papel inválido.");
  if (userId === actor.id) throw forbidden("Não pode alterar o seu próprio papel.");
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.isDemo !== actor.isDemo) throw notFound("Membro não encontrado.");
  if (target.role === "investor") throw forbidden("O papel de investidor só pode ser alterado pelo operador.");
  if (target.role === role) return target;
  return db.transaction(async (tx) => {
    const [u] = await tx.update(users).set({ role: role as AssignableRole }).where(eq(users.id, userId)).returning();
    await logDecision({ actorId: actor.id, action: "role_changed", summary: `${u.name} passou a ${ROLE_LABEL[u.role].toLowerCase()}.` }, tx);
    return u;
  });
}
