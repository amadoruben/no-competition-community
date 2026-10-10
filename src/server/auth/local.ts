import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "@/db";
import { authAttempts, credentials, passwordResets, sessions } from "@/db/schema";
import { logger } from "../logger";
import { sendEmail } from "../mail";
import { hashPassword, verifyPassword } from "./passwords";
import { AuthError, type AuthIdentity, type AuthProvider } from "./types";

const COOKIE = "ncc_session";
const SESSION_TTL_MS = 30 * 864e5;
const RESET_TTL_MS = 60 * 60 * 1000;
export const THROTTLE = { attempts: 8, windowMs: 15 * 60 * 1000 };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const normalise = (email: string) => email.trim().toLowerCase();

/** Self-hosted identity store in the application's own Postgres. */
export class LocalAuthProvider implements AuthProvider {
  readonly name = "local";

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const key = normalise(email);
    const since = new Date(Date.now() - THROTTLE.windowMs);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(authAttempts)
      .where(and(eq(authAttempts.key, key), gt(authAttempts.createdAt, since)));
    if (n >= THROTTLE.attempts) throw new AuthError("Demasiadas tentativas. Aguarde alguns minutos e tente de novo.", "throttled");

    const [cred] = await db.select().from(credentials).where(eq(credentials.email, key)).limit(1);
    const ok = await verifyPassword(password, cred?.passwordHash);
    if (!cred || !ok) {
      await db.insert(authAttempts).values({ key });
      throw new AuthError("Email ou palavra-passe incorrectos.");
    }
    await db.delete(authAttempts).where(eq(authAttempts.key, key));
    await this.startSession(cred.subject);
    return { subject: cred.subject, email: cred.email };
  }

  async signUp(email: string, password: string) {
    const identity = await this.provisionIdentity(email, password);
    await this.startSession(identity.subject);
    return { identity, needsEmailConfirmation: false };
  }

  async provisionIdentity(email: string, password: string): Promise<AuthIdentity> {
    const key = normalise(email);
    const [existing] = await db.select().from(credentials).where(eq(credentials.email, key)).limit(1);
    if (existing) throw new AuthError("Já existe uma conta com este email.", "exists");
    const subject = randomUUID();
    await db.insert(credentials).values({ subject, email: key, passwordHash: await hashPassword(password) });
    return { subject, email: key };
  }

  async currentIdentity(): Promise<AuthIdentity | null> {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    const [row] = await db
      .select({ subject: sessions.subject, expiresAt: sessions.expiresAt, email: credentials.email })
      .from(sessions)
      .innerJoin(credentials, eq(credentials.subject, sessions.subject))
      .where(eq(sessions.id, sha256(token)))
      .limit(1);
    if (!row || row.expiresAt.getTime() < Date.now()) return null;
    return { subject: row.subject, email: row.email };
  }

  async deleteIdentity(subject: string) {
    // Sessions and reset tokens go with the credentials (ON DELETE CASCADE).
    await db.delete(credentials).where(eq(credentials.subject, subject));
    (await cookies()).delete(COOKIE);
  }

  async signOut() {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
    jar.delete(COOKIE);
  }

  async requestPasswordReset(email: string, redirectTo: string) {
    const [cred] = await db.select().from(credentials).where(eq(credentials.email, normalise(email))).limit(1);
    if (!cred) return; // do not reveal whether the account exists
    const token = randomBytes(32).toString("base64url");
    await db.insert(passwordResets).values({ id: sha256(token), subject: cred.subject, expiresAt: new Date(Date.now() + RESET_TTL_MS) });
    const link = `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}token=${token}`;
    await sendEmail({
      to: cred.email,
      subject: "Redefinir palavra-passe — No Competition Community",
      text: `Para definir uma nova palavra-passe abra este link (válido 1 hora):\n\n${link}\n\nSe não pediu esta alteração, ignore este email.`,
    });
  }

  async completePasswordReset({ token, password }: { token: string; password: string }): Promise<AuthIdentity> {
    const id = sha256(token);
    const [reset] = await db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.id, id), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
      .limit(1);
    if (!reset) throw new AuthError("O link expirou ou já foi utilizado. Peça um novo.");
    const passwordHash = await hashPassword(password);
    const [cred] = await db.transaction(async (tx) => {
      await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, id));
      // Invalidate every existing session for this identity.
      await tx.delete(sessions).where(eq(sessions.subject, reset.subject));
      return tx.update(credentials).set({ passwordHash, updatedAt: new Date() }).where(eq(credentials.subject, reset.subject)).returning();
    });
    await this.startSession(cred.subject);
    logger.info("auth.password_reset", { subject: cred.subject });
    return { subject: cred.subject, email: cred.email };
  }

  private async startSession(subject: string) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.insert(sessions).values({ id: sha256(token), subject, expiresAt });
    (await cookies()).set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
      path: "/",
      expires: expiresAt,
    });
  }
}
