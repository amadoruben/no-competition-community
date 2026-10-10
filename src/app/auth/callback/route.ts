import { NextResponse, type NextRequest } from "next/server";
import { resolveUser } from "@/server/accounts";
import { auth } from "@/server/auth";
import { logger } from "@/server/logger";
import { homeFor } from "@/server/session";

/**
 * Landing point for email links (sign-up confirmation) from the auth provider:
 * ?code=… (Supabase default template, PKCE) or ?token_hash=…&type=email (custom
 * template, works on any device — see docs/SUPABASE-SETUP.md).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? undefined;
  const tokenHash = url.searchParams.get("token_hash") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const provider = auth();
  if ((!code && !tokenHash) || !provider.exchangeCallback) return NextResponse.redirect(new URL("/login", url));
  try {
    const user = await resolveUser(await provider.exchangeCallback({ code, tokenHash, type }));
    return NextResponse.redirect(new URL(`${homeFor(user)}?welcome=1`, url));
  } catch (e) {
    logger.warn("auth.callback_failed", { error: e });
    return NextResponse.redirect(new URL("/login?error=link", url));
  }
}
