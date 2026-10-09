/**
 * Classifies infrastructure failures (database or provider unreachable,
 * timeouts, pool exhaustion) so callers can report "nothing was saved"
 * honestly instead of a generic crash or, worse, a false success.
 */
const NETWORK_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "EPIPE",
  "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "DB_SOCKET_TIMEOUT",
]);

// SQLSTATE classes: 08 connection exception, 53 insufficient resources,
// 57 operator intervention (admin shutdown, statement timeout = 57014).
const SQLSTATE_UNAVAILABLE = /^(08|53|57)/;

export function isInfraUnavailable(e: unknown): boolean {
  for (let cur: unknown = e, depth = 0; cur && depth < 5; cur = (cur as { cause?: unknown }).cause, depth++) {
    const code = String((cur as { code?: unknown }).code ?? "");
    if (NETWORK_CODES.has(code) || SQLSTATE_UNAVAILABLE.test(code)) return true;
    const msg = String((cur as { message?: unknown }).message ?? "");
    if (/connect(ion)? (timeout|refused|terminated)|timeout exceeded|too many clients|Connection terminated/i.test(msg)) return true;
  }
  return false;
}

export const UNAVAILABLE_MESSAGE =
  "O serviço de dados está temporariamente indisponível. A operação não foi guardada — tente novamente dentro de momentos.";
