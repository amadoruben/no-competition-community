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

/** Pixel size from the image header (PNG IHDR, JPEG SOFn, WebP VP8 / VP8L / VP8X); null if unreadable. */
export function imageSize(b: Uint8Array, type: string): { width: number; height: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (type === "image/png") return b.length >= 24 ? { width: dv.getUint32(16), height: dv.getUint32(20) } : null;
  if (type === "image/jpeg") {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) i += 1;
      else if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) i += 2; // markers without a length
      else if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      else i += 2 + dv.getUint16(i + 2);
    }
    return null;
  }
  if (type === "image/webp" && b.length >= 30) {
    const chunk = String.fromCharCode(...b.slice(12, 16));
    if (chunk === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = dv.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  return null;
}

export async function readImage(file: unknown) {
  if (!(file instanceof Blob) || file.size === 0) throw invalid("Seleccione uma imagem.", { file: "Seleccione uma imagem." });
  if (file.size > MAX_IMAGE_BYTES) throw invalid("A imagem deve ter no máximo 2 MB.", { file: "Máximo 2 MB." });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw invalid("Formato não suportado. Use PNG, JPEG ou WebP.", { file: "Use PNG, JPEG ou WebP." });
  const size = imageSize(bytes, kind.type);
  if (!size || size.width < 1 || size.height < 1 || size.width > 12000 || size.height > 12000) throw invalid("Não foi possível ler a imagem.", { file: "Imagem inválida." });
  return { bytes, ...kind, ...size };
}

export type ReadImage = Awaited<ReturnType<typeof readImage>>;

/**
 * Store first, then record. If the database write fails the object is removed,
 * so a failed upload never leaves a dangling reference or a false success.
 */
export async function store(owner: User, prefix: string, file: unknown | ReadImage) {
  const img = isRead(file) ? file : await readImage(file);
  const key = `${prefix}/${randomUUID()}.${img.ext}`;
  await storage().put(key, img.bytes, img.type);
  try {
    const [row] = await db.insert(files).values({ storageKey: key, contentType: img.type, size: img.bytes.length, ownerId: owner.id }).returning();
    return { ...row, width: img.width, height: img.height };
  } catch (e) {
    await storage().delete(key).catch(() => {});
    throw e;
  }
}

const isRead = (f: unknown): f is ReadImage => typeof f === "object" && f !== null && "bytes" in f && "ext" in f;

/** Remove a stored file (row and object). Object removal is best-effort and logged. */
export async function discard(fileId: string | null) {
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
