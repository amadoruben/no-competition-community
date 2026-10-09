import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challenges, participations, projectMembers, projects, results, submissions, users, type User } from "@/db/schema";
import { notFound } from "./errors";
import { optionalUrl, parse, text } from "./validation";

export function listMembers(q?: string) {
  const rows = db
    .select({
      u: users,
      projectCount: sql<number>`(select count(*) from ${projectMembers} m where m.user_id = "users"."id")`,
      challengeCount: sql<number>`(select count(*) from ${participations} p where p.user_id = "users"."id")`,
    })
    .from(users)
    .orderBy(asc(users.name))
    .all();
  const needle = q?.trim().toLowerCase();
  return rows.filter((r) => !needle || `${r.u.name} ${r.u.headline} ${r.u.skills.join(" ")} ${r.u.location}`.toLowerCase().includes(needle));
}

export function getMember(handle: string) {
  const u = db.select().from(users).where(eq(users.handle, handle)).get();
  if (!u) throw notFound("Membro não encontrado.");
  const memberProjects = db
    .select({ p: projects, title: projectMembers.title })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, u.id))
    .orderBy(desc(projects.updatedAt))
    .all();
  const challengeRows = db
    .select({ c: challenges, projectId: participations.projectId })
    .from(participations)
    .innerJoin(challenges, eq(challenges.id, participations.challengeId))
    .where(and(eq(participations.userId, u.id), ne(challenges.status, "draft")))
    .orderBy(desc(participations.createdAt))
    .all();
  // Achievements: only published results are public.
  const achievements = db
    .select({ rank: results.rank, challengeTitle: challenges.title, challengeSlug: challenges.slug, projectName: projects.name, projectSlug: projects.slug, at: challenges.resultsPublishedAt })
    .from(results)
    .innerJoin(challenges, eq(challenges.id, results.challengeId))
    .innerJoin(submissions, eq(submissions.id, results.submissionId))
    .innerJoin(projects, eq(projects.id, submissions.projectId))
    .innerJoin(projectMembers, and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, u.id)))
    .where(eq(challenges.status, "results_published"))
    .orderBy(asc(results.rank))
    .all();
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

export function updateProfile(actor: User, input: unknown) {
  const v = parse(profileInput, input);
  return db.update(users).set(v).where(eq(users.id, actor.id)).returning().get();
}

export function evaluatorsDirectory() {
  return db.select().from(users).where(sql`${users.role} in ('evaluator','investor')`).orderBy(asc(users.name)).all();
}
