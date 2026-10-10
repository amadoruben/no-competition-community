/**
 * Scoring engine. One pure function feeds every surface (evaluation view,
 * comparison, results, rankings), so no two screens can disagree.
 *
 * Evaluators mark each criterion 0–10. A single evaluation's score is the
 * weighted mean, scaled to 0–100:
 *
 *   score = 10 · Σ(mark_c · w_c) / Σ(w_c)
 *
 * A submission's score is the mean of its complete evaluations. Weights are
 * relative, so re-weighting a rubric never invalidates stored marks.
 */

export const MAX_MARK = 10;

export interface CriterionWeight {
  id: string;
  weight: number;
}

export function isCompleteEvaluation(
  scores: Record<string, number>,
  criteria: CriterionWeight[],
) {
  return criteria.every((c) => {
    const v = scores[c.id];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_MARK;
  });
}

export function weightedScore(scores: Record<string, number>, criteria: CriterionWeight[]) {
  const active = criteria.filter((c) => c.weight > 0);
  if (active.length === 0 || !isCompleteEvaluation(scores, active)) return null;
  const totalWeight = active.reduce((s, c) => s + c.weight, 0);
  const sum = active.reduce((s, c) => s + scores[c.id] * c.weight, 0);
  return round1((sum / totalWeight) * (100 / MAX_MARK));
}

export interface SubmissionScore {
  submissionId: string;
  score: number | null;
  evaluationCount: number;
  /** Mean mark per criterion across evaluations (0–10). */
  criterionMeans: Record<string, number>;
}

export function aggregateSubmission(
  submissionId: string,
  evaluations: { scores: Record<string, number> }[],
  criteria: CriterionWeight[],
): SubmissionScore {
  const complete = evaluations.filter((e) => isCompleteEvaluation(e.scores, criteria));
  const scores = complete
    .map((e) => weightedScore(e.scores, criteria))
    .filter((s): s is number => s !== null);
  const criterionMeans: Record<string, number> = {};
  for (const c of criteria) {
    if (complete.length === 0) continue;
    criterionMeans[c.id] = round1(
      complete.reduce((s, e) => s + e.scores[c.id], 0) / complete.length,
    );
  }
  return {
    submissionId,
    score: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    evaluationCount: complete.length,
    criterionMeans,
  };
}

/**
 * Standard competition ranking ("1224"): equal scores share a rank.
 * Unscored submissions are placed last, unranked.
 */
export function rankByScore<T extends { score: number | null }>(items: T[]) {
  const sorted = [...items].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((item, i) => {
    if (item.score === null) return { ...item, rank: null as number | null };
    if (item.score !== lastScore) {
      lastRank = i + 1;
      lastScore = item.score;
    }
    return { ...item, rank: lastRank as number | null };
  });
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
