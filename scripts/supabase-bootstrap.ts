/**
 * npm run supabase:bootstrap
 * Idempotent one-off setup of the Supabase project for this app:
 *  - creates the private storage bucket (STORAGE_BUCKET) with size/type limits.
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Runs locally or in the Vercel
 * build (--skip-if-unconfigured: no-op unless STORAGE_PROVIDER=supabase); never in the browser.
 */
import { createClient } from "@supabase/supabase-js";
import { secretKey, supabaseUrl } from "../src/lib/supabase-env";

async function main() {
  const url = supabaseUrl(process.env);
  const key = secretKey(process.env);
  const bucket = process.env.STORAGE_BUCKET ?? "ncc-files";
  if (process.argv.includes("--skip-if-unconfigured") && (process.env.STORAGE_PROVIDER !== "supabase" || !url || !key)) {
    console.warn("⚠ Supabase storage not configured: skipping bucket setup.");
    return;
  }
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const options = { public: false, fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] };
  const { data: existing } = await sb.storage.getBucket(bucket);
  const { error } = existing ? await sb.storage.updateBucket(bucket, options) : await sb.storage.createBucket(bucket, options);
  if (error) throw error;
  console.log(`Bucket "${bucket}" ${existing ? "updated" : "created"} (private, 2 MB, png/jpeg/webp).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
