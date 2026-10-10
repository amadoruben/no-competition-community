/** Reactions members can leave on a post: one per member per post; choosing another replaces it. */
export const REACTION_KINDS = ["heart", "fire", "clap", "raised", "bulb", "laugh", "wow", "pray"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_EMOJI: Record<ReactionKind, { emoji: string; label: string }> = {
  heart: { emoji: "❤️", label: "Gosto" },
  fire: { emoji: "🔥", label: "Fogo" },
  clap: { emoji: "👏", label: "Palmas" },
  raised: { emoji: "🙌", label: "Boa!" },
  bulb: { emoji: "💡", label: "Boa ideia" },
  laugh: { emoji: "😂", label: "Riso" },
  wow: { emoji: "😮", label: "Uau" },
  pray: { emoji: "🙏", label: "Obrigado" },
};
