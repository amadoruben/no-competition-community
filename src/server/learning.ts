import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessonProgress, lessons, modules, type User } from "@/db/schema";
import { notFound } from "./errors";

export function listCourses(viewer: User) {
  const all = db.select().from(courses).orderBy(asc(courses.position)).all();
  const mods = db.select().from(modules).all();
  const less = db.select({ id: lessons.id, moduleId: lessons.moduleId, durationMin: lessons.durationMin }).from(lessons).all();
  const done = new Set(db.select({ id: lessonProgress.lessonId }).from(lessonProgress).where(eq(lessonProgress.userId, viewer.id)).all().map((r) => r.id));
  return all.map((c) => {
    const modIds = mods.filter((m) => m.courseId === c.id).map((m) => m.id);
    const ls = less.filter((l) => modIds.includes(l.moduleId));
    return {
      ...c,
      lessonCount: ls.length,
      minutes: ls.reduce((s, l) => s + l.durationMin, 0),
      completed: ls.filter((l) => done.has(l.id)).length,
    };
  });
}

export function getCourse(viewer: User, slug: string) {
  const course = db.select().from(courses).where(eq(courses.slug, slug)).get();
  if (!course) throw notFound("Curso não encontrado.");
  const mods = db.select().from(modules).where(eq(modules.courseId, course.id)).orderBy(asc(modules.position)).all();
  const ls = mods.length
    ? db.select().from(lessons).where(inArray(lessons.moduleId, mods.map((m) => m.id))).orderBy(asc(lessons.position)).all()
    : [];
  const done = new Set(
    ls.length
      ? db
          .select({ id: lessonProgress.lessonId })
          .from(lessonProgress)
          .where(and(eq(lessonProgress.userId, viewer.id), inArray(lessonProgress.lessonId, ls.map((l) => l.id))))
          .all()
          .map((r) => r.id)
      : [],
  );
  const outline = mods.map((m) => ({ ...m, lessons: ls.filter((l) => l.moduleId === m.id).map((l) => ({ ...l, done: done.has(l.id) })) }));
  const flat = outline.flatMap((m) => m.lessons);
  return { course, outline, flat, completed: flat.filter((l) => l.done).length };
}

export function setLessonComplete(viewer: User, lessonId: string, complete: boolean) {
  if (!db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, lessonId)).get()) throw notFound("Aula não encontrada.");
  if (complete) db.insert(lessonProgress).values({ userId: viewer.id, lessonId }).onConflictDoNothing().run();
  else db.delete(lessonProgress).where(and(eq(lessonProgress.userId, viewer.id), eq(lessonProgress.lessonId, lessonId))).run();
}
