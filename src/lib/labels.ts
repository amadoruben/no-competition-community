import type { AccessTier, OpportunityStatus, PostKind, PrizeKind, ProjectStage, Role, SubmissionStatus } from "@/db/schema";
import type { ChallengePhase } from "./challenge-state";
import type { Tone } from "@/components/ui";

export const STAGE_LABEL: Record<ProjectStage, string> = {
  idea: "Ideia",
  prototype: "Protótipo",
  mvp: "MVP",
  traction: "Tracção",
  scaling: "Escala",
};

export const ACCESS_LABEL: Record<AccessTier, string> = {
  free: "Acesso livre",
  full: "Acesso completo",
};

export const ROLE_LABEL: Record<Role, string> = {
  member: "Membro",
  evaluator: "Avaliador(a)",
  investor: "Investidor(a)",
};

export const PHASE_TONE: Record<ChallengePhase, Tone> = {
  draft: "neutral",
  upcoming: "info",
  open: "gold",
  paused: "warn",
  reviewing: "violet",
  results: "dark",
};

export const PRIZE_KIND_LABEL: Record<PrizeKind, string> = {
  prize: "Prémio",
  investment: "Oportunidade de investimento",
  recognition: "Reconhecimento",
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: "Submetido",
  shortlisted: "Shortlist",
  not_selected: "Não seleccionado",
};

export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus, Tone> = {
  submitted: "neutral",
  shortlisted: "gold",
  not_selected: "bad",
};

export const OPPORTUNITY_TONE: Record<OpportunityStatus, Tone> = {
  interest: "info",
  due_diligence: "violet",
  term_sheet: "warn",
  invested: "ok",
  declined: "neutral",
};

export const ordinal = (n: number) => `${n}.º`;

export const POST_KIND_LABEL: Record<PostKind, string> = {
  announcement: "Anúncio",
  discussion: "Discussão",
  progress: "Progresso",
  question: "Pergunta",
};
