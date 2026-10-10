import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challenges, participations, projectMembers, projects, results, submissions, users, type User } from "@/db/schema";
import { notFound } from "./errors";
import { optionalUrl, parse, text } from "./validation";

/** Columns safe to show to other members (never email or auth subject). */
export const publicProfile = {
  id: users.id,
  name: users.name,
  handle: users.handle,
  role: users.role,
  headline: users.headline,
  bio: users.bio,
  location: users.location,
  skills: users.skills,
  websiteUrl: users.websiteUrl,
  linkedinUrl: users.linkedinUrl,
  githubUrl: users.githubUrl,
  avatarHue: users.avatarHue,
  avatarFileId: users.avatarFileId,
};

export async function listMembers(opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? 24;
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%` : null;
  const where = like
    ? or(ilike(users.name, like), ilike(users.headline, like), ilike(users.location, like), sql`${users.skills}::text ilike ${like}`)
    : undefined;
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(users).where(where),
    db
      .select({
        u: publicProfile,
        projectCount: sql<number>`(select count(*)::int from ${projectMembers} m where m.user_id = "users"."id")`,
        challengeCount: sql<number>`(select count(*)::int from ${participations} p where p.user_id = "users"."id")`,
      })
      .from(users)
      .where(where)
      .orderBy(asc(users.name), asc(users.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getMember(handle: string) {
  const [u] = await db.select(publicProfile).from(users).where(eq(users.handle, handle)).limit(1);
  if (!u) throw notFound("Membro não encontrado.");
  const [memberProjects, challengeRows, achievements] = await Promise.all([
    db
      .select({ p: projects, title: projectMembers.title })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, u.id))
      .orderBy(desc(projects.updatedAt)),
    db
      .select({ c: challenges, projectId: participations.projectId })
      .from(participations)
      .innerJoin(challenges, eq(challenges.id, participations.challengeId))
      .where(and(eq(participations.userId, u.id), ne(challenges.status, "draft")))
      .orderBy(desc(participations.createdAt)),
    // Achievements: only published results are public.
    db
      .select({ rank: results.rank, challengeTitle: challenges.title, challengeSlug: challenges.slug, projectName: projects.name, projectSlug: projects.slug, at: challenges.resultsPublishedAt })
      .from(results)
      .innerJoin(challenges, eq(challenges.id, results.challengeId))
      .innerJoin(submissions, eq(submissions.id, results.submissionId))
      .innerJoin(projects, eq(projects.id, submissions.projectId))
      .innerJoin(projectMembers, and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, u.id)))
      .where(eq(challenges.status, "results_published"))
      .orderBy(asc(results.rank)),
  ]);
  return { user: u, projects: memberProjects, challenges: challengeRows, achievements };
}

const profileInput = z.object({
  name: text(2, 80, "Nome"),
  headline: z.string().trim().max(120).default(""),
  bio: z.string().trim().max(1500).default(""),
  location: z.string().trim().max(80).default(""),
  skills: z.string().default("").transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12)),
  websiteUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
});

export async function updateProfile(actor: User, input: unknown) {
  const v = parse(profileInput, input);
  const [u] = await db.update(users).set(v).where(eq(users.id, actor.id)).returning();
  return u;
}

export async function evaluatorsDirectory() {
  return db.select(publicProfile).from(users).where(inArray(users.role, ["evaluator", "investor"])).orderBy(asc(users.name));
}
