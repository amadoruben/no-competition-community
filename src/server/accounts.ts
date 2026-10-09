import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { slugify } from "@/lib/slug";
import type { AuthIdentity } from "./auth/types";
import { PASSWORD_MIN } from "./auth/passwords";
import { conflict } from "./errors";
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
  if (bySubject) return bySubject;
  const [byEmail] = await db.select().from(users).where(and(eq(users.email, identity.email), isNull(users.authSubject))).limit(1);
  if (byEmail) {
    const [linked] = await db.update(users).set({ authSubject: identity.subject }).where(eq(users.id, byEmail.id)).returning();
    logger.info("auth.linked", { userId: linked.id });
    return linked;
  }
  const name = nameHint ?? identity.email.split("@")[0];
  return createMemberProfile(name, identity);
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
