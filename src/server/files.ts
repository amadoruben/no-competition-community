import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { files, projects, users, type User } from "@/db/schema";
import { forbidden, invalid, notFound } from "./errors";
import { logger } from "./logger";
import { isProjectMember } from "./permissions";
import { loadProject } from "./projects";
import { storage } from "./storage";
import { isUuid } from "./validation";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Detect the image type from its bytes; the browser-declared type is not trusted. */
export function sniffImage(b: Uint8Array): { type: string; ext: string } | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

async function readImage(file: unknown) {
  if (!(file instanceof Blob) || file.size === 0) throw invalid("Seleccione uma imagem.", { file: "Seleccione uma imagem." });
  if (file.size > MAX_IMAGE_BYTES) throw invalid("A imagem deve ter no máximo 2 MB.", { file: "Máximo 2 MB." });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw invalid("Formato não suportado. Use PNG, JPEG ou WebP.", { file: "Use PNG, JPEG ou WebP." });
  return { bytes, ...kind };
}

/**
 * Store first, then record. If the database write fails the object is removed,
 * so a failed upload never leaves a dangling reference or a false success.
 */
async function store(owner: User, prefix: string, file: unknown) {
  const img = await readImage(file);
  const key = `${prefix}/${randomUUID()}.${img.ext}`;
  await storage().put(key, img.bytes, img.type);
  try {
    const [row] = await db.insert(files).values({ storageKey: key, contentType: img.type, size: img.bytes.length, ownerId: owner.id }).returning();
    return row;
  } catch (e) {
    await storage().delete(key).catch(() => {});
    throw e;
  }
}

async function discard(fileId: string | null) {
  if (!fileId) return;
  const [row] = await db.delete(files).where(eq(files.id, fileId)).returning();
  if (row) await storage().delete(row.storageKey).catch((e) => logger.warn("storage.delete_failed", { key: row.storageKey, error: e }));
}

export async function uploadProjectLogo(actor: User, projectId: string, file: unknown) {
  const p = await loadProject(projectId);
  if (!(await isProjectMember(actor.id, p.id))) throw forbidden("Apenas a equipa pode alterar o logótipo.");
  const row = await store(actor, `projects/${p.id}`, file);
  await db.update(projects).set({ logoFileId: row.id, updatedAt: new Date() }).where(eq(projects.id, p.id));
  await discard(p.logoFileId);
}

export async function removeProjectLogo(actor: User, projectId: string) {
  const p = await loadProject(projectId);
  if (!(await isProjectMember(actor.id, p.id))) throw forbidden("Apenas a equipa pode alterar o logótipo.");
  await db.update(projects).set({ logoFileId: null }).where(eq(projects.id, p.id));
  await discard(p.logoFileId);
}

export async function uploadAvatar(actor: User, file: unknown) {
  const row = await store(actor, `avatars/${actor.id}`, file);
  await db.update(users).set({ avatarFileId: row.id }).where(eq(users.id, actor.id));
  await discard(actor.avatarFileId);
}

export async function removeAvatar(actor: User) {
  await db.update(users).set({ avatarFileId: null }).where(eq(users.id, actor.id));
  await discard(actor.avatarFileId);
}

/** Resolve a file id for serving. Avatars and logos are visible to signed-in members. */
export async function fileForServing(id: string) {
  if (!isUuid(id)) throw notFound();
  const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  if (!row) throw notFound();
  return row;
}
