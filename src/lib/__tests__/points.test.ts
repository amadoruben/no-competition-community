import { describe, expect, it } from "vitest";
import { buildLedger, POINT_RULES, standings, type PointFacts } from "../points";

const empty: PointFacts = { enrollments: [], submissions: [], projectUpdates: [], posts: [], comments: [], lessons: [], results: [] };
const d = (s: string) => new Date(s);

describe("points ledger", () => {
  it("caps community points per day and ignores announcements", () => {
    const posts = Array.from({ length: 5 }, (_, i) => ({ userId: "u", at: d(`2026-03-01T10:0${i}:00Z`), kind: "discussion" }));
    const ledger = buildLedger({ ...empty, posts: [...posts, { userId: "u", at: d("2026-03-01T12:00:00Z"), kind: "announcement" }] });
    expect(ledger.reduce((s, e) => s + e.points, 0)).toBe(POINT_RULES.communityDailyCap);
  });

  it("separates merit from participation and applies placement points", () => {
    const ledger = buildLedger({
      ...empty,
      enrollments: [{ userId: "a", challengeId: "c", at: d("2026-03-01") }],
      results: [{ userId: "a", challengeId: "c", challengeTitle: "C", rank: 1, finalScore: 82.4, placementPoints: [300, 200], at: d("2026-03-05") }],
    });
    const [s] = standings(ledger);
    expect(s).toMatchObject({ userId: "a", participation: 10, merit: 82 + 300, total: 392, rank: 1 });
  });

  it("filters by window and ranks with shared ties", () => {
    const ledger = buildLedger({
      ...empty,
      enrollments: [
        { userId: "a", challengeId: "c", at: d("2026-03-01") },
        { userId: "b", challengeId: "c", at: d("2026-03-08") },
        { userId: "c", challengeId: "c", at: d("2026-03-09") },
      ],
    });
    const weekly = standings(ledger, { since: d("2026-03-05") });
    expect(weekly.map((s) => [s.userId, s.rank])).toEqual([["b", 1], ["c", 1]]);
    expect(standings(ledger, { sortBy: "merit" })).toEqual([]);
  });
});
