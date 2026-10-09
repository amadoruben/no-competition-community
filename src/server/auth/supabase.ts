import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AuthError, type AuthIdentity, type AuthProvider } from "./types";

/**
 * Supabase Auth adapter. The only module that imports the Supabase auth SDK.
 * Sessions live in Supabase-managed cookies; `currentIdentity` validates the
 * JWT with the Supabase Auth server (getUser), never trusting the cookie alone.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = "supabase";

  constructor(
    private url = required("NEXT_PUBLIC_SUPABASE_URL"),
    private publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    /** Injectable for contract tests; defaults to global fetch. */
    private fetchImpl?: typeof fetch,
  ) {}

  private async client() {
    const jar = await cookies();
    return createServerClient(this.url, this.publishableKey, {
      ...(this.fetchImpl ? { global: { fetch: this.fetchImpl } } : {}),
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
    return createClient(this.url, required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const { data, error } = await (await this.client()).auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      if (error?.status === 429) throw new AuthError("Demasiadas tentativas. Aguarde alguns minutos e tente de novo.", "throttled");
      if (error?.code === "email_not_confirmed") throw new AuthError("Confirme o seu email antes de entrar.", "unconfirmed");
      throw new AuthError("Email ou palavra-passe incorrectos.");
    }
    return { subject: data.user.id, email: data.user.email! };
  }

  async signUp(email: string, password: string) {
    const { data, error } = await (await this.client()).auth.signUp({ email, password });
    if (error || !data.user) {
      if (error?.code === "user_already_exists") throw new AuthError("Já existe uma conta com este email.", "exists");
      throw new AuthError(error?.message ?? "Não foi possível criar a conta.");
    }
    return { identity: { subject: data.user.id, email: data.user.email! }, needsEmailConfirmation: !data.session };
  }

  async currentIdentity(): Promise<AuthIdentity | null> {
    const { data } = await (await this.client()).auth.getUser();
    return data.user ? { subject: data.user.id, email: data.user.email! } : null;
  }

  async signOut() {
    await (await this.client()).auth.signOut();
  }

  async requestPasswordReset(email: string, redirectTo: string) {
    // Supabase returns success regardless of whether the email exists.
    await (await this.client()).auth.resetPasswordForEmail(email, { redirectTo });
  }

  /** `token` is the PKCE code from the email link (…/reset-password?code=…). */
  async completePasswordReset({ token, password }: { token: string; password: string }): Promise<AuthIdentity> {
    const sb = await this.client();
    const { error: exchangeError } = await sb.auth.exchangeCodeForSession(token);
    if (exchangeError) throw new AuthError("O link expirou ou já foi utilizado. Peça um novo.");
    const { data, error } = await sb.auth.updateUser({ password });
    if (error || !data.user) throw new AuthError("Não foi possível actualizar a palavra-passe.");
    return { subject: data.user.id, email: data.user.email! };
  }

  async provisionIdentity(email: string, password: string): Promise<AuthIdentity> {
    const { data, error } = await this.admin().auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      if (error?.code === "email_exists") throw new AuthError("Já existe uma conta com este email.", "exists");
      throw new AuthError(error?.message ?? "Falha ao criar identidade.");
    }
    return { subject: data.user.id, email: data.user.email! };
  }
}

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required when AUTH_PROVIDER=supabase`);
  return v;
}
