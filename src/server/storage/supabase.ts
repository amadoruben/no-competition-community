import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "./types";
import { secretKey, supabaseUrl } from "@/lib/supabase-env";

/**
 * Supabase Storage adapter (server-side only, service role key). The bucket is
 * private; reads go through short-lived signed URLs issued by /files/[id].
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";
  private client: SupabaseClient;

  constructor(
    url = supabaseUrl(process.env)!,
    serviceKey = secretKey(process.env)!,
    private bucket = process.env.STORAGE_BUCKET ?? "ncc-files",
  ) {
    this.client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async put(key: string, body: Uint8Array, contentType: string) {
    const { error } = await this.client.storage.from(this.bucket).upload(key, body, { contentType, upsert: false });
    if (error) throw new Error(`storage.put failed: ${error.message}`);
  }

  async get(key: string) {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) return null;
    return { body: new Uint8Array(await data.arrayBuffer()), contentType: data.type };
  }

  async delete(key: string) {
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw new Error(`storage.delete failed: ${error.message}`);
  }

  async signedUrl(key: string, ttlSeconds: number) {
    const { data } = await this.client.storage.from(this.bucket).createSignedUrl(key, ttlSeconds);
    return data?.signedUrl ?? null;
  }
}
