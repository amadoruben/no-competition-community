/**
 * Points are derived from stored facts on every read — there is no counter to
 * drift. Two separate tracks keep popularity from being mistaken for quality:
 *
 * - Participation rewards showing up and shipping (enrolments, submissions,
 *   progress updates, community contributions, lessons). It is capped per
 *   day so volume cannot outrun substance.
 * - Merit comes only from published challenge results: the evaluated score and
 *   the placement points each challenge defines. Reactions never score.
 */

export const POINT_RULES = {
  enrollment: 10,
  submission: 40,
  projectUpdate: 5,
  post: 3,
  comment: 1,
  lessonCompleted: 2,
  /** Max community points (posts + comments) per member per day. */
  communityDailyCap: 10,
  /** Max progress updates counted per member per day. */
  updatesPerDay: 1,
  /** Merit points per evaluated point (score is 0–100). */
  meritPerScorePoint: 1,
} as const;

export type PointKind = "participation" | "merit";

export interface LedgerEntry {
  userId: string;
  points: number;
  kind: PointKind;
  reason: string;
  at: Date;
  challengeId?: string;
}

export interface PointFacts {
  enrollments: { userId: string; challengeId: string; at: Date }[];
  /** One row per credited member of the submitted project. */
  submissions: { userId: string; challengeId: string; at: Date }[];
  projectUpdates: { userId: string; at: Date }[];
  posts: { userId: string; at: Date; kind: string }[];
  comments: { userId: string; at: Date }[];
  lessons: { userId: string; at: Date }[];
  /** Published results, one row per credited project member. */
  results: {
    userId: string;
    challengeId: string;
    challengeTitle: string;
    rank: number;
    finalScore: number | null;
    placementPoints: number[];
    at: Date;
  }[];
}

const dayKey = (userId: string, at: Date) => `${userId}:${at.toISOString().slice(0, 10)}`;

export function buildLedger(f: PointFacts): LedgerEntry[] {
  const ledger: LedgerEntry[] = [];
  const P = POINT_RULES;

  for (const e of f.enrollments)
    ledger.push({ userId: e.userId, points: P.enrollment, kind: "participation", reason: "Inscrição em desafio", at: e.at, challengeId: e.challengeId });
  for (const s of f.submissions)
    ledger.push({ userId: s.userId, points: P.submission, kind: "participation", reason: "Submissão entregue", at: s.at, challengeId: s.challengeId });

  const updatesPerDay = new Map<string, number>();
  for (const u of [...f.projectUpdates].sort((a, b) => +a.at - +b.at)) {
    const k = dayKey(u.userId, u.at);
    const n = updatesPerDay.get(k) ?? 0;
    if (n >= P.updatesPerDay) continue;
    updatesPerDay.set(k, n + 1);
    ledger.push({ userId: u.userId, points: P.projectUpdate, kind: "participation", reason: "Actualização de projecto", at: u.at });
  }

  // Community contributions share one daily cap. Announcements are official
  // communications, not participation, so they do not score.
  const community = [
    ...f.posts
      .filter((p) => p.kind !== "announcement")
      .map((p) => ({ userId: p.userId, at: p.at, points: P.post, reason: "Publicação na comunidade" })),
    ...f.comments.map((c) => ({ userId: c.userId, at: c.at, points: P.comment, reason: "Comentário" })),
  ].sort((a, b) => +a.at - +b.at);
  const communityPerDay = new Map<string, number>();
  for (const c of community) {
    const k = dayKey(c.userId, c.at);
    const used = communityPerDay.get(k) ?? 0;
    const points = Math.min(c.points, P.communityDailyCap - used);
    if (points <= 0) continue;
    communityPerDay.set(k, used + points);
    ledger.push({ userId: c.userId, points, kind: "participation", reason: c.reason, at: c.at });
  }

  for (const l of f.lessons)
    ledger.push({ userId: l.userId, points: P.lessonCompleted, kind: "participation", reason: "Aula concluída", at: l.at });

  for (const r of f.results) {
    const placement = r.placementPoints[r.rank - 1] ?? 0;
    const quality = r.finalScore === null ? 0 : Math.round(r.finalScore * P.meritPerScorePoint);
    if (quality > 0)
      ledger.push({ userId: r.userId, points: quality, kind: "merit", reason: `Avaliação em “${r.challengeTitle}”`, at: r.at, challengeId: r.challengeId });
    if (placement > 0)
      ledger.push({ userId: r.userId, points: placement, kind: "merit", reason: `${r.rank}.º lugar em “${r.challengeTitle}”`, at: r.at, challengeId: r.challengeId });
  }

  return ledger;
}

export interface Standing {
  userId: string;
  total: number;
  participation: number;
  merit: number;
  rank: number;
}

export function standings(
  ledger: LedgerEntry[],
  opts: { since?: Date; sortBy?: "total" | "participation" | "merit" } = {},
): Standing[] {
  const sortBy = opts.sortBy ?? "total";
  const by = new Map<string, Standing>();
  for (const e of ledger) {
    if (opts.since && e.at < opts.since) continue;
    const s = by.get(e.userId) ?? { userId: e.userId, total: 0, participation: 0, merit: 0, rank: 0 };
    s.total += e.points;
    s[e.kind] += e.points;
    by.set(e.userId, s);
  }
  const rows = [...by.values()]
    .filter((s) => s[sortBy] > 0)
    .sort((a, b) => b[sortBy] - a[sortBy] || b.total - a.total || a.userId.localeCompare(b.userId));
  let prev: number | null = null;
  let rank = 0;
  rows.forEach((s, i) => {
    if (s[sortBy] !== prev) {
      rank = i + 1;
      prev = s[sortBy];
    }
    s.rank = rank;
  });
  return rows;
}
