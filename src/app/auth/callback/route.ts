import { NextResponse, type NextRequest } from "next/server";
import { resolveUser } from "@/server/accounts";
import { auth } from "@/server/auth";
import { logger } from "@/server/logger";
import { homeFor } from "@/server/session";

/** Landing point for email links (sign-up confirmation) from the auth provider. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const provider = auth();
  if (!code || !provider.exchangeCallback) return NextResponse.redirect(new URL("/login", url));
  try {
    const user = await resolveUser(await provider.exchangeCallback(code));
    return NextResponse.redirect(new URL(`${homeFor(user)}?welcome=1`, url));
  } catch (e) {
    logger.warn("auth.callback_failed", { error: e });
    return NextResponse.redirect(new URL("/login?error=link", url));
  }
}
