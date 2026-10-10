import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { slugify } from "@/lib/slug";
import type { AuthIdentity } from "./auth/types";
import { PASSWORD_MIN } from "./auth/passwords";
import { ownerEmails } from "./config";
import { conflict, forbidden, invalid } from "./errors";
import { discard } from "./files";
import { logger } from "./logger";
import { parse, text } from "./validation";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ message: "Email inválido." }));
export const passwordSchema = z.string().min(PASSWORD_MIN, `A palavra-passe deve ter pelo menos ${PASSWORD_MIN} caracteres.`).max(200);

export const registerSchema = z.object({ name: text(2, 80, "Nome"), email: emailSchema, password: passwordSchema });

/**
 * Map a provider identity to the application user. Links by email when an
 * account exists without a subject (provider migration) and creates a member
 * profile for identities created directly at the provider.
 */
export async function resolveUser(identity: AuthIdentity, nameHint?: string): Promise<User> {
  const [bySubject] = await db.select().from(users).where(eq(users.authSubject, identity.subject)).limit(1);
  if (bySubject) return ownerPromotion(bySubject, identity);
  const [byEmail] = await db.select().from(users).where(and(eq(users.email, identity.email), isNull(users.authSubject))).limit(1);
  if (byEmail) {
    const [linked] = await db.update(users).set({ authSubject: identity.subject }).where(eq(users.id, byEmail.id)).returning();
    logger.info("auth.linked", { userId: linked.id });
    return ownerPromotion(linked, identity);
  }
  const name = nameHint ?? identity.name ?? identity.email.split("@")[0];
  return ownerPromotion(await createMemberProfile(name, identity), identity);
}

/**
 * OWNER_EMAILS: the platform owner becomes the investor on first sign-in, so a
 * fresh deployment needs no CLI step. Only for an email the provider verified
 * (a confirmed link), otherwise anyone could register the owner's address.
 */
async function ownerPromotion(u: User, identity: AuthIdentity): Promise<User> {
  if (u.role === "investor" || !identity.emailVerified || !ownerEmails().includes(identity.email.toLowerCase())) return u;
  const [promoted] = await db.update(users).set({ role: "investor" }).where(eq(users.id, u.id)).returning();
  logger.info("auth.owner_promoted", { userId: u.id });
  return promoted;
}

async function createMemberProfile(name: string, identity: AuthIdentity) {
  const base = slugify(name);
  let handle = base;
  for (let i = 2; (await db.select({ id: users.id }).from(users).where(eq(users.handle, handle)).limit(1)).length; i++) handle = `${base}-${i}`;
  const [u] = await db
    .insert(users)
    .values({ name, email: identity.email, authSubject: identity.subject, handle, role: "member", avatarHue: Math.floor(Math.random() * 360) })
    .returning();
  return u;
}

/** Validate registration input and reject duplicates before touching the provider. */
export async function validateRegistration(input: unknown) {
  const v = parse(registerSchema, input);
  if ((await db.select({ id: users.id }).from(users).where(eq(users.email, v.email)).limit(1)).length)
    throw conflict("Já existe uma conta com este email.");
  return v;
}

/**
 * Self-service account erasure (GDPR art. 17). Removes the profile, what only
 * belongs to it (posts, comments, reactions, enrolments, lesson progress — ON
 * DELETE CASCADE), the avatar and the identity at the auth provider.
 *
 * Refused while the account owns records other people depend on (projects,
 * submissions, evaluations, challenges, results, decisions): the database's
 * foreign keys decide, so nothing is ever left dangling.
 *
 * Order: (1) the deletion is tried in a transaction that is always rolled back,
 * so a refusal changes nothing; (2) the identity is removed — if the provider
 * fails, the profile is intact and the user can retry; (3) the profile is
 * deleted. The provider call never runs inside a transaction (it may use the
 * database itself, and holding a connection while waiting on it can deadlock
 * a small pool).
 */
export async function deleteAccount(user: User, confirmEmail: string, deleteIdentity: (subject: string) => Promise<void>) {
  if (user.isDemo) throw forbidden("As contas de demonstração não podem ser eliminadas.");
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase())
    throw invalid("Escreva o email da sua conta para confirmar.", { confirm: "O email não coincide com o da sua conta." });

  const dryRun = Symbol("dry-run");
  try {
    await db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.id, user.id));
      throw dryRun;
    });
  } catch (e) {
    if (e !== dryRun) {
      if (sqlState(e) === "23503")
        throw conflict("A sua conta tem projectos, submissões, avaliações ou desafios associados e não pode ser eliminada automaticamente. Contacte-nos para a eliminar.");
      throw e;
    }
  }

  if (user.authSubject) await deleteIdentity(user.authSubject);
  try {
    await db.delete(users).where(eq(users.id, user.id));
  } catch (e) {
    // Only if work was attached between the check and now: the identity is gone, the profile stays for an operator.
    logger.error("account.delete_incomplete", { userId: user.id, error: e });
    throw e;
  }
  await discard(user.avatarFileId);
  logger.info("account.deleted", { userId: user.id });
}

function sqlState(e: unknown): string | undefined {
  for (let cur = e as { code?: unknown; cause?: unknown } | undefined, i = 0; cur && i < 5; cur = cur.cause as typeof cur, i++)
    if (typeof cur.code === "string" && /^[0-9A-Z]{5}$/.test(cur.code)) return cur.code;
}

export async function userBySubject(subject: string) {
  const [u] = await db.select().from(users).where(eq(users.authSubject, subject)).limit(1);
  return u ?? null;
}

/**
 * Operator action (CLI only, needs database credentials): change a user's role.
 * There is deliberately no web endpoint for this: the first investor of a real
 * installation is created here, after they register normally.
 */
export async function setUserRole(email: string, role: User["role"]) {
  const key = parse(emailSchema, email);
  const [u] = await db.update(users).set({ role }).where(eq(users.email, key)).returning();
  if (!u) throw new Error(`No user with email ${key}. They must register (or sign in once) first.`);
  logger.info("account.role_changed", { userId: u.id, role });
  return u;
}
