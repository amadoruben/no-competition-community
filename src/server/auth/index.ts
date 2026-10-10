import "server-only";
import { LocalAuthProvider } from "./local";
import { SupabaseAuthProvider } from "./supabase";
import type { AuthProvider } from "./types";

export * from "./types";

let provider: AuthProvider | undefined;

/** Selected by AUTH_PROVIDER (local | supabase). */
export function auth(): AuthProvider {
  if (provider) return provider;
  const name = process.env.AUTH_PROVIDER ?? "local";
  if (name === "supabase") provider = new SupabaseAuthProvider();
  else if (name === "local") provider = new LocalAuthProvider();
  else throw new Error(`Unknown AUTH_PROVIDER "${name}"`);
  return provider;
}
