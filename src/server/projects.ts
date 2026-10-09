import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  challenges,
  opportunities,
  participations,
  posts,
  projectMembers,
  projects,
  PROJECT_STAGES,
  projectUpdates,
  results,
  submissions,
  users,
  type User,
} from "@/db/schema";
import { slugify } from "@/lib/slug";
import { forbidden, invalid, notFound } from "./errors";
import { isInvestor, isProjectMember } from "./permissions";
import { optionalUrl, parse, text } from "./validation";

const projectInput = z.object({
  name: text(2, 60, "Nome"),
  tagline: text(10, 140, "Frase de apresentação"),
  description: z.string().trim().max(4000).default(""),
  problem: z.string().trim().max(2000).default(""),
  solution: z.string().trim().max(2000).default(""),
  category: text(2, 40, "Categoria"),
  stage: z.enum(PROJECT_STAGES, { message: "Seleccione a fase." }),
  logoHue: z.coerce.number().int().min(0).max(360),
  websiteUrl: optionalUrl,
  demoUrl: optionalUrl,
  repoUrl: optionalUrl,
});

function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get();
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export function createProject(actor: User, input: unknown) {
  if (actor.role !== "member") throw forbidden("Apenas membros podem criar projectos.");
  const v = parse(projectInput, input);
  return db.transaction((tx) => {
    const p = tx.insert(projects).values({ ...v, slug: uniqueSlug(v.name), ownerId: actor.id }).returning().get();
    tx.insert(projectMembers).values({ projectId: p.id, userId: actor.id, title: "Fundador(a)" }).run();
    return p;
  });
}

export function updateProject(actor: User, projectId: string, input: unknown) {
  const p = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!p) throw notFound("Projecto não encontrado.");
  if (!isProjectMember(actor.id, projectId)) throw forbidden("Apenas a equipa pode editar o projecto.");
  const v = parse(projectInput, input);
  return db
    .update(projects)
    .set({ ...v, slug: p.name === v.name ? p.slug : uniqueSlug(v.name, projectId), updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning()
    .get();
}

const updateInput = z.object({
  title: text(3, 100, "Título"),
  body: text(10, 3000, "Descrição"),
  shareToFeed: z.boolean().default(true),
});

export function addProjectUpdate(actor: User, projectId: string, input: unknown) {
  if (!isProjectMember(actor.id, projectId)) throw forbidden("Apenas a equipa pode publicar actualizações.");
  const v = parse(updateInput, input);
  return db.transaction((tx) => {
    const u = tx.insert(projectUpdates).values({ projectId, authorId: actor.id, title: v.title, body: v.body }).returning().get();
    tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId)).run();
    if (v.shareToFeed)
      tx.insert(posts).values({ authorId: actor.id, kind: "progress", title: v.title, body: v.body, projectId }).run();
    return u;
  });
}

const memberInput = z.object({
  handle: z.string().trim().min(1, "Indique o identificador do membro."),
  title: z.string().trim().max(60).default(""),
});

export function addProjectMember(actor: User, projectId: string, input: unknown) {
  const p = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!p) throw notFound("Projecto não encontrado.");
  if (p.ownerId !== actor.id) throw forbidden("Apenas o fundador pode gerir a equipa.");
  const v = parse(memberInput, input);
  const u = db.select().from(users).where(eq(users.handle, v.handle.replace(/^@/, ""))).get();
  if (!u || u.role !== "member") throw invalid("Membro não encontrado.", { handle: "Nenhum membro com esse identificador." });
  db.insert(projectMembers)
    .values({ projectId, userId: u.id, title: v.title })
    .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { title: v.title } })
    .run();
}

export function projectsForUser(userId: string) {
  return db
    .select({ p: projects })
    .from(projects)
    .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt))
    .all()
    .map((r) => r.p);
}

export function listProjects(filter: { stage?: string; category?: string; q?: string } = {}) {
  const rows = db
    .select({
      p: projects,
      ownerName: users.name,
      ownerHandle: users.handle,
      memberCount: sql<number>`(select count(*) from ${projectMembers} m where m.project_id = "projects"."id")`,
      challengeCount: sql<number>`(select count(*) from ${submissions} s where s.project_id = "projects"."id")`,
      bestRank: sql<number | null>`(select min(r.rank) from ${results} r join ${submissions} s on s.id = r.submission_id join ${challenges} c on c.id = r.challenge_id where s.project_id = "projects"."id" and c.status = 'results_published')`,
    })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.ownerId))
    .orderBy(desc(projects.updatedAt))
    .all();
  const q = filter.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!filter.stage || r.p.stage === filter.stage) &&
      (!filter.category || r.p.category === filter.category) &&
      (!q || `${r.p.name} ${r.p.tagline} ${r.p.category}`.toLowerCase().includes(q)),
  );
}

export function getProjectBySlug(slug: string, viewer: User) {
  const p = db.select().from(projects).where(eq(projects.slug, slug)).get();
  if (!p) throw notFound("Projecto não encontrado.");
  const team = db
    .select({ id: users.id, name: users.name, handle: users.handle, headline: users.headline, avatarHue: users.avatarHue, title: projectMembers.title })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, p.id))
    .all()
    .sort((a, b) => (a.id === p.ownerId ? -1 : b.id === p.ownerId ? 1 : 0));
  const updates = db
    .select({ u: projectUpdates, authorName: users.name, authorHandle: users.handle, authorHue: users.avatarHue })
    .from(projectUpdates)
    .innerJoin(users, eq(users.id, projectUpdates.authorId))
    .where(eq(projectUpdates.projectId, p.id))
    .orderBy(desc(projectUpdates.createdAt))
    .all();
  const isMember = isProjectMember(viewer.id, p.id);
  const subs = db
    .select({
      s: submissions,
      challengeTitle: challenges.title,
      challengeSlug: challenges.slug,
      challengeStatus: challenges.status,
      participantsVisible: challenges.participantsVisible,
      rank: results.rank,
      finalScore: results.finalScore,
    })
    .from(submissions)
    .innerJoin(challenges, eq(challenges.id, submissions.challengeId))
    .leftJoin(results, eq(results.submissionId, submissions.id))
    .where(eq(submissions.projectId, p.id))
    .orderBy(desc(submissions.submittedAt))
    .all()
    .filter((r) => isMember || isInvestor(viewer) || r.participantsVisible)
    .map((r) => ({
      ...r,
      // Results are only disclosed once the investor publishes them.
      rank: r.challengeStatus === "results_published" ? r.rank : null,
      finalScore: r.challengeStatus === "results_published" ? r.finalScore : null,
    }));
  const enrolledChallenges = db
    .select({ title: challenges.title, slug: challenges.slug })
    .from(participations)
    .innerJoin(challenges, eq(challenges.id, participations.challengeId))
    .where(eq(participations.projectId, p.id))
    .all();
  const pipeline = isInvestor(viewer)
    ? db.select().from(opportunities).where(eq(opportunities.projectId, p.id)).orderBy(desc(opportunities.updatedAt)).all()
    : [];
  return { project: p, team, updates, submissions: subs, enrolledChallenges, isMember, isOwner: p.ownerId === viewer.id, opportunities: pipeline };
}

export function projectCategories() {
  return db.selectDistinct({ c: projects.category }).from(projects).orderBy(asc(projects.category)).all().map((r) => r.c);
}

export function projectsByIds(ids: string[]) {
  return ids.length ? db.select().from(projects).where(inArray(projects.id, ids)).all() : [];
}

export function projectMembersOf(projectId: string) {
  return db.select({ userId: projectMembers.userId }).from(projectMembers).where(and(eq(projectMembers.projectId, projectId))).all().map((r) => r.userId);
}
