export type DomainErrorCode = "unauthorized" | "forbidden" | "not_found" | "invalid" | "conflict";

/** Expected business-rule failure. Its message is safe to show to the user. */
export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const forbidden = (msg = "Não tem permissão para esta acção.") => new DomainError("forbidden", msg);
export const notFound = (msg = "Não encontrado.") => new DomainError("not_found", msg);
export const invalid = (msg: string, fieldErrors?: Record<string, string>) =>
  new DomainError("invalid", msg, fieldErrors);
export const conflict = (msg: string) => new DomainError("conflict", msg);
