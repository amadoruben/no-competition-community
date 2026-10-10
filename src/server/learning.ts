/**
 * Exclusive video library on the existing learning model: a collection is a
 * course, its sections are modules, each video is a lesson (video_url + notes).
 * Locked collections never send video titles, links, notes or thumbnails to the browser.
 */
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ACCESS_TIERS, courses, lessonProgress, lessons, modules, type User } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { videoSource } from "@/lib/video";
import { forbidden, notFound } from "./errors";
import { logDecision } from "./log";
import { assertInvestor, canAccessTier } from "./permissions";
import { isUuid, parse, text } from "./validation";

export const LOCKED_MESSAGE = "Este conteúdo é exclusivo para membros com acesso completo, atribuído pela equipa No Competition.";

export async function listCourses(viewer: User) {
  const [all, mods, less, done] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.position), asc(courses.title)),
    db.select().from(modules).orderBy(asc(modules.position)),
    db.select({ id: lessons.id, slug: lessons.slug, title: lessons.title, moduleId: lessons.moduleId, durationMin: lessons.durationMin, videoUrl: lessons.videoUrl, position: lessons.position }).from(lessons).orderBy(asc(lessons.position)),
    db.select({ id: lessonProgress.lessonId }).from(lessonProgress).where(eq(lessonProgress.userId, viewer.id)),
  ]);
  const doneIds = new Set(done.map((r) => r.id));
  return all.map((c) => {
    const modIds = mods.filter((m) => m.courseId === c.id).map((m) => m.id);
    const ls = modIds.flatMap((id) => less.filter((l) => l.moduleId === id));
    const locked = !canAccessTier(viewer, c.accessTier);
    // Locked collections expose only their own title, description and size:
    // no video titles, links, thumbnails (they reveal the video id) or slugs.
    const videos = locked
      ? []
      : ls.map((l) => ({ id: l.id, slug: l.slug, title: l.title, durationMin: l.durationMin, done: doneIds.has(l.id), thumbnail: videoSource(l.videoUrl)?.thumbnail ?? null }));
    return {
      ...c,
      locked,
      lessonCount: ls.length,
      videoCount: ls.filter((l) => l.videoUrl).length,
      minutes: ls.reduce((s, l) => s + l.durationMin, 0),
      completed: locked ? 0 : ls.filter((l) => doneIds.has(l.id)).length,
      thumbnail: videos.map((v) => v.thumbnail).find(Boolean) ?? null,
      videos,
    };
  });
}

/**
 * The library as anyone may see it on the landing page: what a locked
 * collection already shows a member without access (title, access level and
 * size), never videos, links or thumbnails. Empty collections are left out.
 */
export async function publicLibrary(limit = 4) {
  const [all, mods, less] = await Promise.all([
    db
      .select({ id: courses.id, slug: courses.slug, title: courses.title, coverHue: courses.coverHue, accessTier: courses.accessTier })
      .from(courses)
      .orderBy(asc(courses.position), asc(courses.title)),
    db.select({ id: modules.id, courseId: modules.courseId }).from(modules),
    db.select({ moduleId: lessons.moduleId, durationMin: lessons.durationMin, videoUrl: lessons.videoUrl }).from(lessons),
  ]);
  return all
    .map(({ id, ...c }) => {
      const modIds = new Set(mods.filter((m) => m.courseId === id).map((m) => m.id));
      const videos = less.filter((l) => modIds.has(l.moduleId) && l.videoUrl);
      return { ...c, videoCount: videos.length, minutes: videos.reduce((s, l) => s + l.durationMin, 0) };
    })
    .filter((c) => c.videoCount > 0)
    .slice(0, limit);
}

export async function getCourse(viewer: User, slug: string) {
  const [course] = await db.select().from(courses).where(eq(courses.slug, slug)).limit(1);
  if (!course) throw notFound("Colecção não encontrada.");
  const locked = !canAccessTier(viewer, course.accessTier);
  const mods = await db.select().from(modules).where(eq(modules.courseId, course.id)).orderBy(asc(modules.position));
  const ls = mods.length ? await db.select().from(lessons).where(inArray(lessons.moduleId, mods.map((m) => m.id))).orderBy(asc(lessons.position)) : [];
  const size = { lessonCount: ls.length, minutes: ls.reduce((s, l) => s + l.durationMin, 0) };
  // Locked: the collection itself and its size, nothing about the videos in it.
  if (locked) return { course, locked, ...size, outline: [], flat: [], completed: 0 };
  const done = new Set(
    ls.length
      ? (
          await db
            .select({ id: lessonProgress.lessonId })
            .from(lessonProgress)
            .where(and(eq(lessonProgress.userId, viewer.id), inArray(lessonProgress.lessonId, ls.map((l) => l.id))))
        ).map((r) => r.id)
      : [],
  );
  const shown = (l: (typeof ls)[number]) => ({ ...l, done: done.has(l.id), thumbnail: videoSource(l.videoUrl)?.thumbnail ?? null });
  const outline = mods.map((m) => ({ ...m, lessons: ls.filter((l) => l.moduleId === m.id).map(shown) }));
  const flat = outline.flatMap((m) => m.lessons);
  return { course, locked, ...size, outline, flat, completed: flat.filter((l) => l.done).length };
}

/** One video with its collection; refuses locked content on the server. */
export async function getLesson(viewer: User, courseSlug: string, lessonSlug: string) {
  const d = await getCourse(viewer, courseSlug);
  // Checked before the lookup, so a locked collection does not confirm which video slugs exist.
  if (d.locked) throw forbidden(LOCKED_MESSAGE);
  const idx = d.flat.findIndex((l) => l.slug === lessonSlug);
  if (idx < 0) throw notFound("Vídeo não encontrado.");
  return { ...d, lesson: d.flat[idx], prev: d.flat[idx - 1] ?? null, next: d.flat[idx + 1] ?? null };
}

/** Newest videos the viewer can watch, for the home feed. */
export async function latestVideos(viewer: User, limit = 3) {
  const rows = await db
    .select({ id: lessons.id, slug: lessons.slug, title: lessons.title, videoUrl: lessons.videoUrl, durationMin: lessons.durationMin, courseSlug: courses.slug, courseTitle: courses.title, accessTier: courses.accessTier })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .orderBy(desc(courses.position), desc(lessons.position))
    .limit(30);
  return rows
    .filter((r) => canAccessTier(viewer, r.accessTier))
    .slice(0, limit)
    .map(({ videoUrl, ...r }) => ({ ...r, thumbnail: videoSource(videoUrl)?.thumbnail ?? null }));
}

export async function setLessonComplete(viewer: User, lessonId: string, complete: boolean) {
  const [row] = isUuid(lessonId)
    ? await db
        .select({ id: lessons.id, tier: courses.accessTier })
        .from(lessons)
        .innerJoin(modules, eq(modules.id, lessons.moduleId))
        .innerJoin(courses, eq(courses.id, modules.courseId))
        .where(eq(lessons.id, lessonId))
        .limit(1)
    : [];
  if (!row) throw notFound("Vídeo não encontrado.");
  if (!canAccessTier(viewer, row.tier)) throw forbidden(LOCKED_MESSAGE);
  if (complete) await db.insert(lessonProgress).values({ userId: viewer.id, lessonId }).onConflictDoNothing();
  else await db.delete(lessonProgress).where(and(eq(lessonProgress.userId, viewer.id), eq(lessonProgress.lessonId, lessonId)));
}

// --- Administration --------------------------------------------------------

const collectionInput = z.object({
  title: text(3, 100, "Título"),
  description: text(3, 400, "Descrição"),
  accessTier: z.enum(ACCESS_TIERS, { message: "Escolha o acesso." }),
});

async function uniqueSlug(table: typeof courses, base: string) {
  let slug = base;
  for (let i = 2; (await db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).limit(1)).length; i++) slug = `${base}-${i}`;
  return slug;
}

export async function createCollection(actor: User, input: unknown) {
  assertInvestor(actor);
  const v = parse(collectionInput, input);
  const [{ top }] = await db.select({ top: max(courses.position) }).from(courses);
  const [c] = await db
    .insert(courses)
    .values({ ...v, slug: await uniqueSlug(courses, slugify(v.title)), level: "Vídeos", position: (top ?? 0) + 1, coverHue: Math.floor(Math.random() * 360) })
    .returning();
  await logDecision({ actorId: actor.id, action: "collection_created", summary: `Colecção de vídeos “${c.title}” criada.` });
  return c;
}

export async function setCollectionAccess(actor: User, courseId: string, tier: string) {
  assertInvestor(actor);
  const accessTier = parse(z.enum(ACCESS_TIERS), tier);
  if (!isUuid(courseId)) throw notFound("Colecção não encontrada.");
  const [c] = await db.update(courses).set({ accessTier }).where(eq(courses.id, courseId)).returning();
  if (!c) throw notFound("Colecção não encontrada.");
  return c;
}

export async function deleteCollection(actor: User, courseId: string) {
  assertInvestor(actor);
  if (!isUuid(courseId)) throw notFound("Colecção não encontrada.");
  const [c] = await db.delete(courses).where(eq(courses.id, courseId)).returning();
  if (!c) throw notFound("Colecção não encontrada.");
  await logDecision({ actorId: actor.id, action: "collection_deleted", summary: `Colecção de vídeos “${c.title}” removida.` });
}

const videoInput = z.object({
  courseId: z.string().refine(isUuid, "Escolha a colecção."),
  section: z.string().trim().max(80).default(""),
  title: text(3, 140, "Título"),
  videoUrl: z
    .string()
    .trim()
    .refine((v) => videoSource(v) !== null, "Use um link do YouTube, do Vimeo ou de um ficheiro de vídeo https (.mp4, .webm)."),
  content: z.string().trim().max(5000, "Descrição: máximo 5000 caracteres.").default(""),
  durationMin: z.coerce.number().int().min(1, "Duração: pelo menos 1 minuto.").max(600, "Duração: máximo 600 minutos."),
});

/** Adds a video at the end of a section (created on first use; "Vídeos" by default). */
export async function addVideo(actor: User, input: unknown) {
  assertInvestor(actor);
  const v = parse(videoInput, input);
  const [course] = await db.select().from(courses).where(eq(courses.id, v.courseId)).limit(1);
  if (!course) throw notFound("Colecção não encontrada.");
  const sectionTitle = v.section || "Vídeos";
  return db.transaction(async (tx) => {
    let [mod] = await tx.select().from(modules).where(and(eq(modules.courseId, course.id), eq(modules.title, sectionTitle))).limit(1);
    if (!mod) {
      const [{ top }] = await tx.select({ top: max(modules.position) }).from(modules).where(eq(modules.courseId, course.id));
      [mod] = await tx.insert(modules).values({ courseId: course.id, title: sectionTitle, position: (top ?? 0) + 1 }).returning();
    }
    const siblings = await tx
      .select({ slug: lessons.slug, position: lessons.position })
      .from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(eq(modules.courseId, course.id));
    const base = slugify(v.title);
    let slug = base;
    for (let i = 2; siblings.some((s) => s.slug === slug); i++) slug = `${base}-${i}`;
    const [l] = await tx
      .insert(lessons)
      .values({ moduleId: mod.id, slug, title: v.title, videoUrl: v.videoUrl, content: v.content, durationMin: v.durationMin, position: Math.max(0, ...siblings.map((s) => s.position)) + 1 })
      .returning();
    return { ...l, courseSlug: course.slug };
  });
}

export async function deleteVideo(actor: User, lessonId: string) {
  assertInvestor(actor);
  if (!isUuid(lessonId)) throw notFound("Vídeo não encontrado.");
  const [l] = await db.delete(lessons).where(eq(lessons.id, lessonId)).returning();
  if (!l) throw notFound("Vídeo não encontrado.");
}
