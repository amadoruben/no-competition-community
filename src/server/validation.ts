import { z } from "zod";
import { invalid } from "./errors";

/** Parse input with a zod schema, raising a DomainError with per-field messages. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw invalid("Reveja os campos assinalados.", fieldErrors);
}

/** Links shown to other people: web addresses only (no javascript:, data:, vbscript: or other schemes). */
export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.url({ protocol: /^https?$/, message: "Indique um endereço web válido (https://…)." }).nullable());

export const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} é obrigatório.` : `${label}: mínimo ${min} caracteres.`)
    .max(max, `${label}: máximo ${max} caracteres.`);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids come from URLs and forms; anything that is not a UUID cannot exist. */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
