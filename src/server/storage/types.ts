/**
 * File storage behind an application interface. The database stores only a
 * provider-neutral key (files.storage_key); URLs are produced at read time by
 * /files/[id], so moving to another provider means copying objects with the
 * same keys and switching STORAGE_PROVIDER — no row rewrites.
 */
export interface StoredObject {
  body: Uint8Array;
  contentType?: string;
}

export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  /** Short-lived URL for direct download, when the provider supports it. */
  signedUrl?(key: string, ttlSeconds: number): Promise<string | null>;
}
