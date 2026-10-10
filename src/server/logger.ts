/**
 * Structured JSON logs (one line per event) that any host can collect.
 * Secrets never reach the log: sensitive keys and credential-looking strings
 * are redacted before serialisation.
 */
type Level = "debug" | "info" | "warn" | "error";
const SENSITIVE_KEY = /pass(word)?|secret|token|key|authorization|cookie|session|credential|hash/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (typeof value === "string") {
    return value
      .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1***@")
      .replace(/\b(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,})\b/g, "[jwt]")
      .replace(/\b(sb_(?:secret|publishable)_[\w-]+)\b/g, "[supabase-key]");
  }
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return { name: value.name, message: redact(value.message), ...(code ? { code } : {}) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? "***" : redact(v, depth + 1)]),
    );
  }
  return value;
}

function write(level: Level, event: string, data?: Record<string, unknown>) {
  if (level === "debug" && process.env.LOG_LEVEL !== "debug") return;
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(data ? (redact(data) as object) : {}) });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (e: string, d?: Record<string, unknown>) => write("debug", e, d),
  info: (e: string, d?: Record<string, unknown>) => write("info", e, d),
  warn: (e: string, d?: Record<string, unknown>) => write("warn", e, d),
  error: (e: string, d?: Record<string, unknown>) => write("error", e, d),
};
