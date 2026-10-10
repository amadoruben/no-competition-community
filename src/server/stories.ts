/**
 * Stories: short updates shown in a bar at the top of Início for a few days,
 * never in the feed. A story is a `posts` row of kind "story" with an optional
 * photo, so it reuses storage, validation and the demo/real separation.
 *
 * The first circle of the bar, "Novidades", is not a story anyone wrote: it is
 * a digest built from what really happened in the community this week
 * (challenges, results, announcements, videos, new members). It is signed by
 * the community, never attributed to a person.
 */
import { and, asc, count, desc, eq, gte, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challenges, courses, lessons, modules, postMedia, posts, users, type User } from "@/db/schema";
import { challengePhase } from "@/lib/challenge-state";
import { videoSource } from "@/lib/video";
import { mediaFor } from "./community";
import { forbidden, invalid, notFound } from "./errors";
import { discard, readImage, store } from "./files";
import { followeeIds } from "./follows";
import { canAccessTier, isInvestor } from "./permissions";
import { isUuid, parse } from "./validation";

/** How long a story stays in the bar. */
export const STORY_DAYS = 7;
/** Active stories per person, so the bar stays a highlight and not a second feed. */
export const MAX_ACTIVE_STORIES = 10;
const DAY = 864e5;
const since = (days = STORY_DAYS) => new Date(Date.now() - days * DAY);

const storyInput = z.object({ caption: z.string().trim().max(220, "Texto: máximo 220 caracteres.").default("") });
const EMPTY = "Adicione uma fotografia ou escreva um texto.";

/** Stories are the team's: what the community's host and the No Competition team want everyone to see this week. */
export async function createStory(actor: User, input: unknown, image?: unknown) {
  if (!isInvestor(actor)) throw forbidden("Os stories são publicados pela equipa No Competition.");
  const v = parse(storyInput, input);
  const hasImage = image instanceof Blob && image.size > 0;
  if (!v.caption && !hasImage) throw invalid(EMPTY, { caption: EMPTY });
  const [{ n }] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(eq(posts.authorId, actor.id), eq(posts.kind, "story"), gte(posts.createdAt, since())));
  if (n >= MAX_ACTIVE_STORIES) throw invalid(`Já tem ${MAX_ACTIVE_STORIES} stories activos. Elimine um ou espere que expirem.`);
  // The photo is checked (type, size, dimensions) before anything is stored.
  const checked = hasImage ? await readImage(image) : null;
  const stored = checked ? await store(actor, `stories/${actor.id}`, checked) : null;
  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx.insert(posts).values({ authorId: actor.id, kind: "story", title: "", body: v.caption }).returning();
      if (stored) await tx.insert(postMedia).values({ postId: p.id, fileId: stored.id, position: 0, width: stored.width, height: stored.height });
      return p;
    });
  } catch (e) {
    if (stored) await discard(stored.id);
    throw e;
  }
}

/** The author removes their story; the administration may remove any. */
export async function deleteStory(actor: User, storyId: string) {
  const [s] = isUuid(storyId)
    ? await db
        .select({ id: posts.id, authorId: posts.authorId, isDemo: users.isDemo })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(and(eq(posts.id, storyId), eq(posts.kind, "story")))
        .limit(1)
    : [];
  if (!s || s.isDemo !== actor.isDemo) throw notFound("Story não encontrado.");
  if (s.authorId !== actor.id && !isInvestor(actor)) throw forbidden("Só o autor ou a administração podem eliminar este story.");
  const media = await db.select({ fileId: postMedia.fileId }).from(postMedia).where(eq(postMedia.postId, s.id));
  await db.delete(posts).where(eq(posts.id, s.id));
  await Promise.all(media.map((m) => discard(m.fileId)));
}

export type Story = { id: string; caption: string; createdAt: Date; photo: { fileId: string; width: number; height: number } | null };
export type StoryAuthor = { id: string; name: string; handle: string; avatarHue: number; avatarFileId: string | null; role: User["role"] };
export type StoryGroup = { author: StoryAuthor; stories: Story[]; own: boolean; followed: boolean };

/**
 * Active stories on the viewer's side, one group per person: the viewer's own
 * first, then the No Competition team, then people the viewer follows, then
 * everyone else; most recent first. Inside a group, oldest first (play order).
 */
export async function listStories(viewer: User): Promise<StoryGroup[]> {
  const rows = await db
    .select({
      id: posts.id,
      caption: posts.body,
      createdAt: posts.createdAt,
      author: { id: users.id, name: users.name, handle: users.handle, avatarHue: users.avatarHue, avatarFileId: users.avatarFileId, role: users.role },
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.kind, "story"), eq(users.isDemo, viewer.isDemo), gte(posts.createdAt, since())))
    .orderBy(asc(posts.createdAt));
  if (!rows.length) return [];
  const [media, followed] = await Promise.all([mediaFor(rows.map((r) => r.id)), followeeIds(viewer.id)]);
  const follows = new Set(followed);
  const groups = new Map<string, StoryGroup & { latest: number }>();
  for (const r of rows) {
    const g = groups.get(r.author.id) ?? { author: r.author, stories: [], own: r.author.id === viewer.id, followed: follows.has(r.author.id), latest: 0 };
    g.stories.push({ id: r.id, caption: r.caption, createdAt: r.createdAt, photo: media.get(r.id)?.[0] ?? null });
    g.latest = Math.max(g.latest, +r.createdAt);
    groups.set(r.author.id, g);
  }
  const rank = (g: StoryGroup) => (g.own ? 0 : g.author.role === "investor" ? 1 : g.followed ? 2 : 3);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || b.latest - a.latest).map(({ latest: _, ...g }) => g);
}

export type DigestItem = {
  key: string;
  kind: "challenge" | "deadline" | "results" | "announcement" | "video" | "members";
  label: string;
  title: string;
  detail?: string;
  href: string;
  at: Date;
  cover?: { hue: number; seed: string; theme: string };
  thumbnail?: string | null;
};

/**
 * What happened in the community during the last seven days, from the
 * database only. Exclusive videos the viewer cannot open are announced by
 * their collection (which members without access can already see), never by
 * the video's own title.
 */
export async function weeklyDigest(viewer: User): Promise<DigestItem[]> {
  const week = since(7);
  const soon = new Date(Date.now() + 7 * DAY);
  const [published, resulted, closing, announcements, videos, [joined]] = await Promise.all([
    db
      .select()
      .from(challenges)
      .where(and(ne(challenges.status, "draft"), isNotNull(challenges.publishedAt), gte(challenges.publishedAt, week)))
      .orderBy(desc(challenges.publishedAt)),
    db
      .select()
      .from(challenges)
      .where(and(eq(challenges.status, "results_published"), isNotNull(challenges.resultsPublishedAt), gte(challenges.resultsPublishedAt, week)))
      .orderBy(desc(challenges.resultsPublishedAt)),
    db
      .select()
      .from(challenges)
      .where(and(eq(challenges.status, "published"), gte(challenges.submissionDeadline, new Date())))
      .orderBy(asc(challenges.submissionDeadline)),
    db
      .select({ id: posts.id, title: posts.title, body: posts.body, createdAt: posts.createdAt })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(and(eq(posts.kind, "announcement"), eq(users.isDemo, viewer.isDemo), gte(posts.createdAt, week)))
      .orderBy(desc(posts.createdAt))
      .limit(3),
    db
      .select({
        id: lessons.id,
        slug: lessons.slug,
        title: lessons.title,
        videoUrl: lessons.videoUrl,
        createdAt: lessons.createdAt,
        courseSlug: courses.slug,
        courseTitle: courses.title,
        coverHue: courses.coverHue,
        accessTier: courses.accessTier,
      })
      .from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(isNotNull(lessons.createdAt), gte(lessons.createdAt, week), isNotNull(lessons.videoUrl)))
      .orderBy(desc(lessons.createdAt))
      .limit(6),
    db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.isDemo, viewer.isDemo), ne(users.id, viewer.id), gte(users.createdAt, week))),
  ]);

  const items: DigestItem[] = [];
  const cover = (c: { coverHue: number; slug: string; category: string; title: string }) => ({ hue: c.coverHue, seed: c.slug, theme: `${c.category} ${c.title}` });
  for (const c of resulted)
    items.push({ key: `results-${c.id}`, kind: "results", label: "Resultados publicados", title: c.title, detail: "Veja a classificação e os vencedores.", href: `/challenges/${c.slug}?tab=results`, at: c.resultsPublishedAt!, cover: cover(c) });
  for (const c of published)
    if (!resulted.some((r) => r.id === c.id))
      items.push({ key: `challenge-${c.id}`, kind: "challenge", label: challengePhase(c) === "upcoming" ? "Novo desafio · em breve" : "Novo desafio", title: c.title, detail: c.tagline, href: `/challenges/${c.slug}`, at: c.publishedAt!, cover: cover(c) });
  for (const c of closing.filter((c) => c.submissionDeadline <= soon && challengePhase(c) === "open"))
    items.push({ key: `deadline-${c.id}`, kind: "deadline", label: "Prazo a terminar", title: c.title, detail: "As submissões fecham nos próximos dias.", href: `/challenges/${c.slug}`, at: c.submissionDeadline, cover: cover(c) });
  for (const a of announcements)
    items.push({ key: `post-${a.id}`, kind: "announcement", label: "Anúncio oficial", title: a.title || a.body.slice(0, 120), href: `/community/${a.id}`, at: a.createdAt });
  const lockedCourses = new Set<string>();
  for (const v of videos) {
    const open = canAccessTier(viewer, v.accessTier);
    if (open)
      items.push({
        key: `video-${v.id}`,
        kind: "video",
        label: "Novo vídeo",
        title: v.title,
        detail: v.courseTitle,
        href: `/videos/${v.courseSlug}/${v.slug}`,
        at: v.createdAt!,
        cover: { hue: v.coverHue, seed: v.slug, theme: v.courseTitle },
        thumbnail: videoSource(v.videoUrl)?.thumbnail ?? null,
      });
    else if (!lockedCourses.has(v.courseSlug)) {
      lockedCourses.add(v.courseSlug);
      items.push({ key: `course-${v.courseSlug}`, kind: "video", label: "Novo vídeo exclusivo", title: v.courseTitle, detail: "Colecção exclusiva", href: `/videos/${v.courseSlug}`, at: v.createdAt!, cover: { hue: v.coverHue, seed: v.courseSlug, theme: v.courseTitle } });
    }
  }
  if (joined.n > 0)
    items.push({ key: "members", kind: "members", label: "Comunidade", title: joined.n === 1 ? "1 novo membro esta semana" : `${joined.n} novos membros esta semana`, detail: "Dê as boas-vindas no Início.", href: "/members", at: new Date() });
  return items.sort((a, b) => +b.at - +a.at).slice(0, 10);
}

/** People on the viewer's side with at least one active story (their avatars get the story ring). */
export async function activeStoryAuthors(viewer: User) {
  const rows = await db
    .selectDistinct({ id: posts.authorId })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.kind, "story"), eq(users.isDemo, viewer.isDemo), gte(posts.createdAt, since())));
  return new Set(rows.map((r) => r.id));
}
