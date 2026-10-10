import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publishableKey, supabaseUrl } from "@/lib/supabase-env";
import { timedFetch } from "@/lib/timed-fetch";

/**
 * Only active with AUTH_PROVIDER=supabase: refreshes the Supabase session
 * cookies before rendering (Server Components cannot set cookies). With the
 * local provider this is a no-op pass-through.
 */
export async function proxy(request: NextRequest) {
  if (process.env.AUTH_PROVIDER !== "supabase") return NextResponse.next();
  let response = NextResponse.next({ request });
  const url = supabaseUrl(process.env);
  const key = publishableKey(process.env);
  if (!url || !key) return NextResponse.next({ request }); // unconfigured: /api/health reports it
  const supabase = createServerClient(url, key, {
    // Short bound: this runs before every page. If Auth is slow the page still
    // renders (as signed out) instead of the whole request hanging.
    global: { fetch: timedFetch(Number(process.env.AUTH_PROXY_TIMEOUT_MS || 5_000)) },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch (e) {
    console.warn(JSON.stringify({ level: "warn", event: "proxy.session_refresh_failed", error: e instanceof Error ? e.name : "unknown" }));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|api/health|files/).*)"],
};
