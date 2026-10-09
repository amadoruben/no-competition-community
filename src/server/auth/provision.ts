import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { secretKey, supabaseUrl } from "@/lib/supabase-env";
import { credentials } from "@/db/schema";
import { hashPassword } from "./passwords";
import type { AuthIdentity } from "./types";

/**
 * Create (or find) an identity at the configured provider without touching the
 * request. Used by the seed script and admin tooling; safe outside Next.js.
 */
export async function provisionIdentity(email: string, password: string): Promise<AuthIdentity> {
  const key = email.trim().toLowerCase();
  if ((process.env.AUTH_PROVIDER ?? "local") === "supabase") {
    const admin = createClient(supabaseUrl(process.env)!, secretKey(process.env)!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.admin.createUser({ email: key, password, email_confirm: true });
    if (data.user) return { subject: data.user.id, email: key };
    if (error?.code !== "email_exists") throw error ?? new Error("createUser failed");
    for (let page = 1; page < 50; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const hit = list.users.find((u) => u.email === key);
      if (hit) {
        await admin.auth.admin.updateUserById(hit.id, { password });
        return { subject: hit.id, email: key };
      }
      if (list.users.length < 200) break;
    }
    throw new Error(`Identity ${key} exists but could not be found`);
  }
  const [existing] = await db.select().from(credentials).where(eq(credentials.email, key)).limit(1);
  const passwordHash = await hashPassword(password);
  if (existing) {
    await db.update(credentials).set({ passwordHash }).where(eq(credentials.subject, existing.subject));
    return { subject: existing.subject, email: key };
  }
  const subject = randomUUID();
  await db.insert(credentials).values({ subject, email: key, passwordHash });
  return { subject, email: key };
}
