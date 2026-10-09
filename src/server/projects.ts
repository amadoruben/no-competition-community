import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
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
import { isUuid, optionalUrl, parse, text } from "./validation";

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

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const [hit] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export async function loadProject(projectId: string) {
  const [p] = isUuid(projectId) ? await db.select().from(projects).where(eq(projects.id, projectId)).limit(1) : [];
  if (!p) throw notFound("Projecto não encontrado.");
  return p;
}

export async function createProject(actor: User, input: unknown) {
  if (actor.role !== "member") throw forbidden("Apenas membros podem criar projectos.");
  const v = parse(projectInput, input);
  const slug = await uniqueSlug(v.name);
  return db.transaction(async (tx) => {
    const [p] = await tx.insert(projects).values({ ...v, slug, ownerId: actor.id }).returning();
    await tx.insert(projectMembers).values({ projectId: p.id, userId: actor.id, title: "Fundador(a)" });
    return p;
  });
}

export async function updateProject(actor: User, projectId: string, input: unknown) {
  const p = await loadProject(projectId);
  if (!(await isProjectMember(actor.id, projectId))) throw forbidden("Apenas a equipa pode editar o projecto.");
  const v = parse(projectInput, input);
  const slug = p.name === v.name ? p.slug : await uniqueSlug(v.name, projectId);
  const [updated] = await db
    .update(projects)
    .set({ ...v, slug, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return updated;
}

const updateInput = z.object({
  title: text(3, 100, "Título"),
  body: text(10, 3000, "Descrição"),
  shareToFeed: z.boolean().default(true),
});

export async function addProjectUpdate(actor: User, projectId: string, input: unknown) {
  await loadProject(projectId);
  if (!(await isProjectMember(actor.id, projectId))) throw forbidden("Apenas a equipa pode publicar actualizações.");
  const v = parse(updateInput, input);
  return db.transaction(async (tx) => {
    const [u] = await tx.insert(projectUpdates).values({ projectId, authorId: actor.id, title: v.title, body: v.body }).returning();
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
    if (v.shareToFeed) await tx.insert(posts).values({ authorId: actor.id, kind: "progress", title: v.title, body: v.body, projectId });
    return u;
  });
}

const memberInput = z.object({
  handle: z.string().trim().min(1, "Indique o identificador do membro."),
  title: z.string().trim().max(60).default(""),
});

export async function addProjectMember(actor: User, projectId: string, input: unknown) {
  const p = await loadProject(projectId);
  if (p.ownerId !== actor.id) throw forbidden("Apenas o fundador pode gerir a equipa.");
  const v = parse(memberInput, input);
  const [u] = await db.select().from(users).where(eq(users.handle, v.handle.replace(/^@/, ""))).limit(1);
  if (!u || u.role !== "member") throw invalid("Membro não encontrado.", { handle: "Nenhum membro com esse identificador." });
  await db
    .insert(projectMembers)
    .values({ projectId, userId: u.id, title: v.title })
    .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { title: v.title } });
}

export async function removeProjectMember(actor: User, projectId: string, userId: string) {
  const p = await loadProject(projectId);
  if (p.ownerId !== actor.id) throw forbidden("Apenas o fundador pode gerir a equipa.");
  if (userId === p.ownerId) throw invalid("O fundador não pode ser removido da equipa.");
  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

export async function projectsForUser(userId: string) {
  const rows = await db
    .selectDistinct({ p: projects })
    .from(projects)
    .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)))
    .orderBy(desc(projects.updatedAt));
  return rows.map((r) => r.p);
}

export const PROJECT_SORTS = { recent: "Actividade recente", name: "Nome", newest: "Mais recentes" } as const;
export type ProjectSort = keyof typeof PROJECT_SORTS;

export async function listProjects(filter: { stage?: string; category?: string; q?: string; sort?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = filter.pageSize ?? 12;
  const page = Math.max(1, filter.page ?? 1);
  const conds: SQL[] = [];
  if (filter.stage && (PROJECT_STAGES as readonly string[]).includes(filter.stage)) conds.push(eq(projects.stage, filter.stage as (typeof PROJECT_STAGES)[number]));
  if (filter.category) conds.push(eq(projects.category, filter.category));
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(or(ilike(projects.name, like), ilike(projects.tagline, like), ilike(projects.category, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const order =
    filter.sort === "name" ? [asc(projects.name)] : filter.sort === "newest" ? [desc(projects.createdAt)] : [desc(projects.updatedAt)];

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(projects).where(where),
    db
      .select({
        p: projects,
        ownerName: users.name,
        ownerHandle: users.handle,
        memberCount: sql<number>`(select count(*)::int from ${projectMembers} m where m.project_id = "projects"."id")`,
        challengeCount: sql<number>`(select count(*)::int from ${submissions} s where s.project_id = "projects"."id")`,
        bestRank: sql<number | null>`(select min(r.rank) from ${results} r join ${submissions} s on s.id = r.submission_id join ${challenges} c on c.id = r.challenge_id where s.project_id = "projects"."id" and c.status = 'results_published')`,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .where(where)
      .orderBy(...order, asc(projects.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getProjectBySlug(slug: string, viewer: User) {
  const [p] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (!p) throw notFound("Projecto não encontrado.");
  const [team, updates, isMember, subRows, enrolledChallenges, pipeline] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, handle: users.handle, headline: users.headline, avatarHue: users.avatarHue, avatarFileId: users.avatarFileId, title: projectMembers.title })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, p.id)),
    db
      .select({ u: projectUpdates, authorName: users.name, authorHandle: users.handle, authorHue: users.avatarHue })
      .from(projectUpdates)
      .innerJoin(users, eq(users.id, projectUpdates.authorId))
      .where(eq(projectUpdates.projectId, p.id))
      .orderBy(desc(projectUpdates.createdAt)),
    isProjectMember(viewer.id, p.id),
    db
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
      .orderBy(desc(submissions.submittedAt)),
    db
      .select({ title: challenges.title, slug: challenges.slug })
      .from(participations)
      .innerJoin(challenges, eq(challenges.id, participations.challengeId))
      .where(eq(participations.projectId, p.id))
      .groupBy(challenges.id),
    isInvestor(viewer) ? db.select().from(opportunities).where(eq(opportunities.projectId, p.id)).orderBy(desc(opportunities.updatedAt)) : Promise.resolve([]),
  ]);
  const subs = subRows
    .filter((r) => isMember || isInvestor(viewer) || r.participantsVisible)
    .map((r) => ({
      ...r,
      // Results are only disclosed once the investor publishes them.
      rank: r.challengeStatus === "results_published" ? r.rank : null,
      finalScore: r.challengeStatus === "results_published" ? r.finalScore : null,
    }));
  team.sort((a, b) => (a.id === p.ownerId ? -1 : b.id === p.ownerId ? 1 : 0));
  return { project: p, team, updates, submissions: subs, enrolledChallenges, isMember, isOwner: p.ownerId === viewer.id, opportunities: pipeline };
}

export async function projectCategories() {
  const rows = await db.selectDistinct({ c: projects.category }).from(projects).orderBy(asc(projects.category));
  return rows.map((r) => r.c);
}

/** Lightweight id → name list for selectors. */
export async function projectOptions() {
  return db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name));
}
