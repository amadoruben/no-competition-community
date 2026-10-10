import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { TOKEN_HASH_PREFIX } from "@/lib/auth-links";
import { publishableKey as envPublishableKey, SECRET_KEY_VAR, secretKey, supabaseUrl } from "@/lib/supabase-env";
import { authTimeoutMs, timedFetch } from "@/lib/timed-fetch";
import { logger } from "../logger";
import { AuthError, type AuthIdentity, type AuthProvider, type EmailLink } from "./types";

/**
 * Supabase Auth adapter. The only module that imports the Supabase auth SDK.
 * Sessions live in Supabase-managed cookies; `currentIdentity` validates the
 * JWT with the Supabase Auth server (getUser), never trusting the cookie alone.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = "supabase";

  constructor(
    private url = required("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl(process.env)),
    private publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", envPublishableKey(process.env)),
    /** Injectable for contract tests; defaults to global fetch. */
    fetchImpl?: typeof fetch,
    timeoutMs = authTimeoutMs(),
  ) {
    // Every call to Supabase Auth is bounded: a slow or unreachable provider
    // becomes a clear "unavailable" error instead of a request that never ends.
    this.fetch = timedFetch(timeoutMs, fetchImpl);
  }

  private readonly fetch: typeof fetch;

  private async client() {
    const jar = await cookies();
    return createServerClient(this.url, this.publishableKey, {
      global: { fetch: this.fetch },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) jar.set(name, value, options);
          } catch {
            // Called from a Server Component: the proxy refreshes the cookies.
          }
        },
      },
    });
  }

  private admin(): SupabaseClient {
    return createClient(this.url, required(SECRET_KEY_VAR, secretKey(process.env)), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: this.fetch },
    });
  }

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const { data, error } = await (await this.client()).auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      if (error?.code === "email_not_confirmed") throw new AuthError("Confirme o seu email antes de entrar. Se não o encontrar, peça um novo abaixo.", "unconfirmed");
      throw providerError("signIn", error) ?? new AuthError("Email ou palavra-passe incorrectos.");
    }
    return identityOf(data.user);
  }

  async signUp(email: string, password: string, opts?: { confirmRedirect?: string; name?: string }) {
    const { data, error } = await (await this.client()).auth.signUp({
      email,
      password,
      options: {
        ...(opts?.confirmRedirect ? { emailRedirectTo: opts.confirmRedirect } : {}),
        // Kept by Supabase so the profile can be created with it after confirmation.
        ...(opts?.name ? { data: { name: opts.name } } : {}),
      },
    });
    if (error || !data.user) throw signUpError(error);
    // With email confirmation on, Supabase answers a sign-up for an existing
    // address with a placeholder user that has no identities (no enumeration).
    if (data.user.identities?.length === 0) throw new AuthError(EXISTS, "exists");
    return { identity: identityOf(data.user), needsEmailConfirmation: !data.session };
  }

  async resendConfirmation(email: string, confirmRedirect: string) {
    // Supabase answers success for unknown or already-confirmed addresses (no enumeration).
    const { error } = await (await this.client()).auth.resend({ type: "signup", email, options: { emailRedirectTo: confirmRedirect } });
    const e = providerError("resendConfirmation", error);
    if (e) throw e;
  }

  async deleteIdentity(subject: string) {
    const { error } = await this.admin().auth.admin.deleteUser(subject);
    if (error && error.status !== 404) throw providerError("deleteIdentity", error) ?? new AuthError("Não foi possível eliminar a identidade.", "unavailable");
    try {
      await (await this.client()).auth.signOut({ scope: "local" });
    } catch {
      // Session cookies are cleared best-effort; the identity no longer exists.
    }
  }

  async exchangeCallback(link: EmailLink): Promise<AuthIdentity> {
    const sb = await this.client();
    const { data, error } = link.tokenHash
      ? await sb.auth.verifyOtp({ token_hash: link.tokenHash, type: (link.type ?? "email") as "email" | "signup" | "invite" | "magiclink" | "email_change" })
      : await sb.auth.exchangeCodeForSession(link.code ?? "");
    if (error || !data.user) throw providerError("exchangeCallback", error) ?? new AuthError(LINK_FAILED);
    return identityOf(data.user);
  }

  async currentIdentity(): Promise<AuthIdentity | null> {
    const { data } = await (await this.client()).auth.getUser();
    return data.user ? { subject: data.user.id, email: data.user.email! } : null;
  }

  async signOut() {
    await (await this.client()).auth.signOut();
  }

  async requestPasswordReset(email: string, redirectTo: string) {
    // Supabase returns success regardless of whether the email exists; only
    // infrastructure failures and rate limits are reported.
    const { error } = await (await this.client()).auth.resetPasswordForEmail(email, { redirectTo });
    const e = providerError("requestPasswordReset", error);
    if (e) throw e;
  }

  /**
   * `token` is the PKCE code from the email link (…/reset-password?code=…), or
   * `th:<token_hash>` when the email template links with {{ .TokenHash }} (any device).
   */
  async completePasswordReset({ token, password }: { token: string; password: string }): Promise<AuthIdentity> {
    const sb = await this.client();
    const { error: exchangeError } = token.startsWith(TOKEN_HASH_PREFIX)
      ? await sb.auth.verifyOtp({ token_hash: token.slice(TOKEN_HASH_PREFIX.length), type: "recovery" })
      : await sb.auth.exchangeCodeForSession(token);
    if (exchangeError) throw providerError("completePasswordReset", exchangeError) ?? new AuthError(`${LINK_FAILED} Peça um novo.`);
    const { data, error } = await sb.auth.updateUser({ password });
    if (error || !data.user) {
      if (error?.code === "same_password") throw new AuthError("A nova palavra-passe tem de ser diferente da anterior.");
      if (error?.code === "weak_password") throw new AuthError(WEAK_PASSWORD);
      throw providerError("completePasswordReset", error) ?? new AuthError("Não foi possível actualizar a palavra-passe.");
    }
    return { subject: data.user.id, email: data.user.email! };
  }

  async provisionIdentity(email: string, password: string): Promise<AuthIdentity> {
    const { data, error } = await this.admin().auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      if (error?.code === "email_exists") throw new AuthError(EXISTS, "exists");
      throw providerError("provisionIdentity", error) ?? new AuthError(error?.message ?? "Falha ao criar identidade.");
    }
    return { subject: data.user.id, email: data.user.email! };
  }
}

// PKCE links only work in the browser that asked for them; say so instead of a bare "expired".
const LINK_FAILED = "O link expirou, já foi utilizado ou foi aberto noutro browser — abra-o no mesmo browser onde fez o pedido.";
const EXISTS = "Já existe uma conta com este email. Entre ou recupere a palavra-passe.";
const WEAK_PASSWORD = "A palavra-passe é demasiado fraca. Use pelo menos 8 caracteres, misturando letras e números.";
export const AUTH_UNAVAILABLE =
  "O serviço de autenticação não respondeu a tempo. Nada foi alterado do nosso lado — tente novamente dentro de momentos.";

type ProviderError = { name?: string; status?: number; code?: string; message?: string } | null | undefined;

/**
 * Failures that are not about the user's input: provider unreachable or slow
 * (fetch aborted → status 0), provider errors (5xx) and rate limits. Logged
 * with status and code only (never the email). Returns null for input errors,
 * which each caller maps to its own message.
 */
function providerError(op: string, e: ProviderError): AuthError | null {
  if (!e) return null;
  const status = e.status ?? 0;
  const code = e.code ?? "";
  const unavailable =
    status === 0 || status >= 500 || e.name === "AuthRetryableFetchError" || ["request_timeout", "unexpected_failure", "hook_timeout", "hook_timeout_after_retry", "conflict"].includes(code);
  const throttled = status === 429 || code.startsWith("over_");
  if (!unavailable && !throttled) return null;
  logger.warn("auth.provider_error", { op, status, code, name: e.name, message: e.message });
  if (throttled)
    return new AuthError(
      code === "over_email_send_rate_limit"
        ? "O limite de envio de emails foi atingido. Aguarde alguns minutos e tente de novo."
        : "Demasiadas tentativas. Aguarde alguns minutos e tente de novo.",
      "throttled",
    );
  return new AuthError(AUTH_UNAVAILABLE, "unavailable");
}

function signUpError(e: ProviderError): AuthError {
  const code = e?.code ?? "";
  if (code === "user_already_exists" || code === "email_exists") return new AuthError(EXISTS, "exists");
  if (code === "weak_password") return new AuthError(WEAK_PASSWORD);
  if (code === "email_address_invalid") return new AuthError("Este endereço de email não é aceite. Use outro endereço.");
  if (code === "signup_disabled" || code === "email_provider_disabled") return new AuthError("Os registos estão temporariamente fechados.");
  // Default Supabase SMTP only delivers to the organisation's team members;
  // a failed confirmation email must not look like "account created".
  if (code === "email_address_not_authorized" || /error sending .*email/i.test(e?.message ?? "")) {
    logger.warn("auth.provider_error", { op: "signUp", status: e?.status, code, message: e?.message });
    return new AuthError("Não foi possível enviar o email de confirmação para este endereço. A conta não ficou activa — tente mais tarde ou contacte o suporte.", "unavailable");
  }
  const other = providerError("signUp", e);
  if (other) return other;
  logger.warn("auth.provider_error", { op: "signUp", status: e?.status, code, message: e?.message });
  return new AuthError("Não foi possível criar a conta. Verifique os dados e tente novamente.");
}

function identityOf(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AuthIdentity {
  const name = typeof u.user_metadata?.name === "string" ? u.user_metadata.name.trim() : "";
  return { subject: u.id, email: u.email!, ...(name ? { name } : {}) };
}

function required(name: string, v: string | undefined) {
  if (!v) throw new Error(`${name} is required when AUTH_PROVIDER=supabase`);
  return v;
}
