import { describe, expect, it } from "vitest";
import { canEnroll, canSubmit, canTransition, challengePhase } from "../challenge-state";

const base = {
  startsAt: new Date("2026-01-10"),
  submissionDeadline: new Date("2026-02-10"),
};

describe("challengePhase", () => {
  it("derives the member-facing phase from status and dates", () => {
    const pub = { ...base, status: "published" as const };
    expect(challengePhase(pub, new Date("2026-01-01"))).toBe("upcoming");
    expect(challengePhase(pub, new Date("2026-01-20"))).toBe("open");
    expect(challengePhase(pub, new Date("2026-02-10"))).toBe("reviewing");
    expect(challengePhase({ ...base, status: "paused" }, new Date("2026-01-20"))).toBe("paused");
    expect(challengePhase({ ...base, status: "results_published" })).toBe("results");
  });
  it("guards enrolment and submission", () => {
    const pub = { ...base, status: "published" as const };
    expect(canEnroll(pub, new Date("2026-01-01"))).toBe(true);
    expect(canSubmit(pub, new Date("2026-01-01"))).toBe(false);
    expect(canSubmit(pub, new Date("2026-01-20"))).toBe(true);
    expect(canSubmit({ ...base, status: "paused" }, new Date("2026-01-20"))).toBe(false);
    expect(canEnroll({ ...base, status: "draft" }, new Date("2026-01-20"))).toBe(false);
  });
  it("only allows defined status transitions", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("draft", "results_published")).toBe(false);
    expect(canTransition("results_published", "published")).toBe(false);
  });
});
