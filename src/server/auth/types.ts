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
}

export type SignUpResult = { identity: AuthIdentity; needsEmailConfirmation: boolean };

export interface AuthProvider {
  readonly name: string;
  /** Verify credentials and start a session for the current request. */
  signIn(email: string, password: string): Promise<AuthIdentity>;
  /** Create an identity and, when possible, start a session. */
  signUp(email: string, password: string): Promise<SignUpResult>;
  /** Identity of the current request, validated by the provider. */
  currentIdentity(): Promise<AuthIdentity | null>;
  signOut(): Promise<void>;
  /** Send a reset link. Must not reveal whether the email exists. */
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** Finish a reset started by `requestPasswordReset`. */
  completePasswordReset(input: { token: string; password: string }): Promise<AuthIdentity>;
  /** Server-side provisioning (seeding, invitations). */
  provisionIdentity(email: string, password: string): Promise<AuthIdentity>;
}

/** Thrown for invalid credentials or tokens. Message is safe to display. */
export class AuthError extends Error {
  constructor(message: string, public kind: "invalid" | "throttled" | "exists" | "unconfirmed" = "invalid") {
    super(message);
    this.name = "AuthError";
  }
}
