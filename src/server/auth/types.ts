/**
 * Authentication is an infrastructure concern behind this interface. The rest
 * of the application only sees an `AuthIdentity` (a provider subject + email)
 * and maps it to its own `users` row via `users.auth_subject`.
 *
 * To replace the provider: implement this interface, register it in
 * ./index.ts, migrate identities (see docs/OPERATIONS.md), and re-link
 * `users.auth_subject` by email. No page, action or business rule changes.
 */
export interface AuthIdentity {
  subject: string;
  email: string;
  /** Name given at sign-up, when the provider kept it (used to create the profile after email confirmation). */
  name?: string;
}

export type SignUpResult = { identity: AuthIdentity; needsEmailConfirmation: boolean };

export type EmailLink = { code?: string; tokenHash?: string; type?: string };

export interface AuthProvider {
  readonly name: string;
  /** Verify credentials and start a session for the current request. */
  signIn(email: string, password: string): Promise<AuthIdentity>;
  /** Create an identity and, when possible, start a session. `confirmRedirect` is where email confirmation links land. */
  signUp(email: string, password: string, opts?: { confirmRedirect?: string; name?: string }): Promise<SignUpResult>;
  /** Send the sign-up confirmation email again. Optional: local auth has no confirmation step. */
  resendConfirmation?(email: string, confirmRedirect: string): Promise<void>;
  /**
   * Finish an email link (sign-up confirmation). Either a PKCE `code` (works in the
   * browser that started the flow) or a `tokenHash` + `type` (works on any device).
   * Optional: local auth has no confirmation step.
   */
  exchangeCallback?(link: EmailLink): Promise<AuthIdentity>;
  /** Identity of the current request, validated by the provider. */
  currentIdentity(): Promise<AuthIdentity | null>;
  signOut(): Promise<void>;
  /** Send a reset link. Must not reveal whether the email exists. */
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** Finish a reset started by `requestPasswordReset`. */
  completePasswordReset(input: { token: string; password: string }): Promise<AuthIdentity>;
  /** Server-side provisioning (seeding, invitations). */
  provisionIdentity(email: string, password: string): Promise<AuthIdentity>;
  /** Remove the identity and its sessions (account deletion). Idempotent. */
  deleteIdentity(subject: string): Promise<void>;
}

/**
 * Thrown for invalid credentials or tokens, and when the provider cannot be
 * reached in time ("unavailable"). Message is safe to display.
 */
export class AuthError extends Error {
  constructor(message: string, public kind: "invalid" | "throttled" | "exists" | "unconfirmed" | "unavailable" = "invalid") {
    super(message);
    this.name = "AuthError";
  }
}
