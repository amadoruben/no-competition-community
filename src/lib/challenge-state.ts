import type { ChallengeStatus } from "@/db/schema";

/**
 * The phase a member sees is derived from the stored status (an explicit
 * investor decision) and the dates. It is never stored, so it cannot drift
 * from the deadline checks that guard enrolment and submission.
 */
export type ChallengePhase =
  | "draft"
  | "upcoming"
  | "open"
  | "paused"
  | "reviewing"
  | "results";

export interface ChallengeTiming {
  status: ChallengeStatus;
  startsAt: Date;
  submissionDeadline: Date;
}

export function challengePhase(c: ChallengeTiming, now = new Date()): ChallengePhase {
  switch (c.status) {
    case "draft":
      return "draft";
    case "paused":
      return "paused";
    case "results_published":
      return "results";
    case "closed":
      return "reviewing";
    case "published":
      if (now < c.startsAt) return "upcoming";
      if (now >= c.submissionDeadline) return "reviewing";
      return "open";
  }
}

/** Members may enrol before the start date so they can prepare. */
export function canEnroll(c: ChallengeTiming, now = new Date()) {
  const phase = challengePhase(c, now);
  return phase === "upcoming" || phase === "open";
}

export function canSubmit(c: ChallengeTiming, now = new Date()) {
  return challengePhase(c, now) === "open";
}

export const PHASE_LABEL: Record<ChallengePhase, string> = {
  draft: "Rascunho",
  upcoming: "Em breve",
  open: "Inscrições abertas",
  paused: "Em pausa",
  reviewing: "Em avaliação",
  results: "Resultados publicados",
};

export const STATUS_LABEL: Record<ChallengeStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  paused: "Em pausa",
  closed: "Encerrado",
  results_published: "Resultados publicados",
};

/** Status transitions the investor can trigger, keyed by current status. */
export const STATUS_TRANSITIONS: Record<ChallengeStatus, ChallengeStatus[]> = {
  draft: ["published"],
  published: ["paused", "closed"],
  paused: ["published", "closed"],
  closed: ["published"],
  results_published: [],
};

export function canTransition(from: ChallengeStatus, to: ChallengeStatus) {
  return STATUS_TRANSITIONS[from].includes(to);
}
