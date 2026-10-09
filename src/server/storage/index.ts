import { LocalStorageProvider } from "./local";
import { SupabaseStorageProvider } from "./supabase";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";

let provider: StorageProvider | undefined;

/** Selected by STORAGE_PROVIDER (local | supabase). */
export function storage(): StorageProvider {
  if (provider) return provider;
  const name = process.env.STORAGE_PROVIDER ?? "local";
  if (name === "supabase") provider = new SupabaseStorageProvider();
  else if (name === "local") provider = new LocalStorageProvider();
  else throw new Error(`Unknown STORAGE_PROVIDER "${name}"`);
  return provider;
}

/** Tests can inject an in-memory provider. */
export function setStorage(p: StorageProvider) {
  provider = p;
}
