/**
 * Supabase Auth settings the app relies on, as one declarative object for the
 * Management API (PATCH /v1/projects/{ref}/config/auth). Pure: no I/O, no
 * secrets in its errors. Used by scripts/supabase-auth-config.ts.
 */

const SECRET_KEYS = new Set(["smtp_pass"]);

export type AuthConfigPatch = Record<string, string | number | boolean>;

/** "Name <addr@x>" or "addr@x" → parts. */
export function parseFrom(from: string | undefined): { name?: string; email: string } | null {
  const v = from?.trim();
  if (!v) return null;
  const m = v.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  const email = (m ? m[2] : v).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const name = m?.[1]?.trim();
  return { email, ...(name ? { name } : {}) };
}

/** smtps://user:pass@host:465 or smtp://user:pass@host:587 → Supabase SMTP fields. */
export function parseSmtpUrl(url: string | undefined): { host: string; port: number; user: string; pass: string } | null {
  if (!url?.trim()) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "smtp:" && u.protocol !== "smtps:") return null;
  const port = Number(u.port || (u.protocol === "smtps:" ? 465 : 587));
  if (!u.hostname || !u.username || !u.password) return null;
  return { host: u.hostname, port, user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) };
}

// Short, plain, no marketing (Supabase deliverability guidance). The links use
// token_hash so they work on any device, not only in the browser that asked.
const shell = (title: string, body: string, cta: string, href: string) =>
  `<h2>${title}</h2><p>${body}</p><p><a href="${href}">${cta}</a></p><p>Se não fez este pedido, ignore este email.</p>`;

export const AUTH_TEMPLATES = {
  mailer_subjects_confirmation: "Confirme o seu email",
  mailer_templates_confirmation_content: shell(
    "Confirme o seu email",
    "Abra o link abaixo para activar a sua conta na No Competition Community. O link é válido durante pouco tempo e só pode ser usado uma vez.",
    "Confirmar email",
    "{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email",
  ),
  mailer_subjects_recovery: "Definir nova palavra-passe",
  mailer_templates_recovery_content: shell(
    "Definir nova palavra-passe",
    "Recebemos um pedido para definir uma nova palavra-passe. O link é válido durante pouco tempo e só pode ser usado uma vez.",
    "Definir nova palavra-passe",
    "{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery",
  ),
} as const;

export interface AuthConfigInput {
  SMTP_URL?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  /** Extra allowed redirect URLs (comma-separated), e.g. the Preview branch URL with /**. */
  AUTH_REDIRECT_URLS?: string;
  /** Confirmation/reset emails per hour once custom SMTP is on (Supabase default: 30). */
  AUTH_EMAIL_RATE_LIMIT?: string;
}

export function buildAuthConfig(env: AuthConfigInput, opts: { templates?: boolean } = {}): { patch: AuthConfigPatch; problems: string[] } {
  const problems: string[] = [];
  const patch: AuthConfigPatch = { external_email_enabled: true, mailer_autoconfirm: false, mailer_secure_email_change_enabled: true };

  const smtp = parseSmtpUrl(env.SMTP_URL);
  const from = parseFrom(env.EMAIL_FROM);
  if (!smtp) problems.push("SMTP_URL: required, as smtps://USER:PASSWORD@HOST:465 (or smtp://…:587)");
  if (!from) problems.push('EMAIL_FROM: required, as "No Competition Community <no-reply@auth.your-domain>"');
  if (smtp && from) {
    Object.assign(patch, {
      smtp_host: smtp.host,
      smtp_port: String(smtp.port),
      smtp_user: smtp.user,
      smtp_pass: smtp.pass,
      smtp_admin_email: from.email,
      smtp_sender_name: from.name ?? "No Competition Community",
    });
  }

  if (env.APP_URL) {
    try {
      const site = new URL(env.APP_URL);
      if (site.protocol !== "https:" && site.hostname !== "localhost") problems.push("APP_URL: must be https (production address)");
      patch.site_url = site.origin;
      const allow = [`${site.origin}/**`, ...(env.AUTH_REDIRECT_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean)];
      patch.uri_allow_list = [...new Set(allow)].join(",");
    } catch {
      problems.push("APP_URL: not a valid URL");
    }
  }

  if (env.AUTH_EMAIL_RATE_LIMIT) {
    const n = Number(env.AUTH_EMAIL_RATE_LIMIT);
    if (!Number.isInteger(n) || n < 1 || n > 10_000) problems.push("AUTH_EMAIL_RATE_LIMIT: an integer between 1 and 10000");
    else patch.rate_limit_email_sent = n;
  }

  if (opts.templates !== false) Object.assign(patch, AUTH_TEMPLATES);
  return { patch, problems };
}

/** For display: secrets masked, templates summarised. */
export function describePatch(patch: AuthConfigPatch): string[] {
  return Object.entries(patch).map(([k, v]) =>
    SECRET_KEYS.has(k) ? `${k} = ••••••` : k.startsWith("mailer_templates_") ? `${k} = <${String(v).length} chars, PT-PT, token_hash link>` : `${k} = ${v}`,
  );
}
