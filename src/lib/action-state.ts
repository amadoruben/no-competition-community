export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Distinguishes consecutive results with identical content. */
  at: number;
} | null;
