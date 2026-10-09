import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { conflict, DomainError } from "./errors";
import { parse, text } from "./validation";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, 10);
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.insert(sessions).values({ id: hashToken(token), userId, expiresAt }).run();
  return { token, expiresAt };
}

export function userForSessionToken(token: string): User | null {
  const row = db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, hashToken(token)))
    .get();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  return row.user;
}

export function deleteSession(token: string) {
  db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Email inválido." })),
  password: z.string().min(1, "Indique a palavra-passe."),
});

export function verifyCredentials(input: unknown): User {
  const { email, password } = parse(credentialsSchema, input);
  const user = db.select().from(users).where(eq(users.email, email)).get();
  // Compare against a dummy hash when the user is unknown to keep timing uniform.
  const ok = bcrypt.compareSync(password, user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok) throw new DomainError("unauthorized", "Email ou palavra-passe incorrectos.");
  return user;
}

const registerSchema = z.object({
  name: text(2, 80, "Nome"),
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Email inválido." })),
  password: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres.").max(200),
});

export function registerMember(input: unknown): User {
  const data = parse(registerSchema, input);
  if (db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).get())
    throw conflict("Já existe uma conta com este email.");
  let handle = slugify(data.name);
  for (let i = 2; db.select({ id: users.id }).from(users).where(eq(users.handle, handle)).get(); i++)
    handle = `${slugify(data.name)}-${i}`;
  return db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash: hashPassword(data.password),
      handle,
      role: "member",
      avatarHue: Math.floor(Math.random() * 360),
    })
    .returning()
    .get();
}
