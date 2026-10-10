import { describe, expect, it } from "vitest";
import { aggregateSubmission, rankByScore, weightedScore } from "../scoring";

const criteria = [
  { id: "a", weight: 3 },
  { id: "b", weight: 1 },
];

describe("weightedScore", () => {
  it("computes a weighted mean scaled to 0–100", () => {
    expect(weightedScore({ a: 8, b: 4 }, criteria)).toBe(70);
    expect(weightedScore({ a: 10, b: 10 }, criteria)).toBe(100);
  });
  it("returns null for incomplete or out-of-range marks", () => {
    expect(weightedScore({ a: 8 }, criteria)).toBeNull();
    expect(weightedScore({ a: 11, b: 4 }, criteria)).toBeNull();
  });
  it("ignores zero-weight criteria", () => {
    expect(weightedScore({ a: 5 }, [{ id: "a", weight: 1 }, { id: "z", weight: 0 }])).toBe(50);
  });
});

describe("aggregateSubmission", () => {
  it("averages complete evaluations only", () => {
    const r = aggregateSubmission("s", [{ scores: { a: 8, b: 4 } }, { scores: { a: 6, b: 6 } }, { scores: { a: 1 } }], criteria);
    expect(r.evaluationCount).toBe(2);
    expect(r.score).toBe(65);
    expect(r.criterionMeans).toEqual({ a: 7, b: 5 });
  });
  it("has no score without evaluations", () => {
    expect(aggregateSubmission("s", [], criteria).score).toBeNull();
  });
});

describe("rankByScore", () => {
  it("shares ranks on ties and leaves unscored unranked", () => {
    const ranked = rankByScore([
      { id: "x", score: 70 },
      { id: "y", score: 90 },
      { id: "z", score: 70 },
      { id: "w", score: null },
      { id: "v", score: 50 },
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["y", 1], ["x", 2], ["z", 2], ["v", 4], ["w", null],
    ]);
  });
});
