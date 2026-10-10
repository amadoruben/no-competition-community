import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessonProgress, lessons, modules, type User } from "@/db/schema";
import { notFound } from "./errors";
import { isUuid } from "./validation";

export async function listCourses(viewer: User) {
  const [all, mods, less, done] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.position)),
    db.select().from(modules),
    db.select({ id: lessons.id, moduleId: lessons.moduleId, durationMin: lessons.durationMin }).from(lessons),
    db.select({ id: lessonProgress.lessonId }).from(lessonProgress).where(eq(lessonProgress.userId, viewer.id)),
  ]);
  const doneIds = new Set(done.map((r) => r.id));
  return all.map((c) => {
    const modIds = mods.filter((m) => m.courseId === c.id).map((m) => m.id);
    const ls = less.filter((l) => modIds.includes(l.moduleId));
    return {
      ...c,
      lessonCount: ls.length,
      minutes: ls.reduce((s, l) => s + l.durationMin, 0),
      completed: ls.filter((l) => doneIds.has(l.id)).length,
    };
  });
}

export async function getCourse(viewer: User, slug: string) {
  const [course] = await db.select().from(courses).where(eq(courses.slug, slug)).limit(1);
  if (!course) throw notFound("Curso não encontrado.");
  const mods = await db.select().from(modules).where(eq(modules.courseId, course.id)).orderBy(asc(modules.position));
  const ls = mods.length ? await db.select().from(lessons).where(inArray(lessons.moduleId, mods.map((m) => m.id))).orderBy(asc(lessons.position)) : [];
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
  const outline = mods.map((m) => ({ ...m, lessons: ls.filter((l) => l.moduleId === m.id).map((l) => ({ ...l, done: done.has(l.id) })) }));
  const flat = outline.flatMap((m) => m.lessons);
  return { course, outline, flat, completed: flat.filter((l) => l.done).length };
}

export async function setLessonComplete(viewer: User, lessonId: string, complete: boolean) {
  const [exists] = isUuid(lessonId) ? await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, lessonId)).limit(1) : [];
  if (!exists) throw notFound("Aula não encontrada.");
  if (complete) await db.insert(lessonProgress).values({ userId: viewer.id, lessonId }).onConflictDoNothing();
  else await db.delete(lessonProgress).where(and(eq(lessonProgress.userId, viewer.id), eq(lessonProgress.lessonId, lessonId)));
}
