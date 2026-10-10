import { NextResponse } from "next/server";
import { DomainError } from "@/server/errors";
import { fileForServing } from "@/server/files";
import { currentUser } from "@/server/session";
import { isPublicFile } from "@/server/social";
import { storage } from "@/server/storage";

/**
 * Stable, provider-neutral URL for stored files (/files/<id>). Redirects to a
 * short-lived signed URL when the provider offers one, otherwise streams.
 */
export async function GET(_: Request, ctx: RouteContext<"/files/[id]">) {
  const { id } = await ctx.params;
  // Files need a session, except the covers of social publications the team shows on the public page.
  const signedIn = !!(await currentUser());
  if (!signedIn && !(await isPublicFile(id))) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const file = await fileForServing(id);
    const s = storage();
    const signed = s.signedUrl ? await s.signedUrl(file.storageKey, 300) : null;
    if (signed) return NextResponse.redirect(signed, { headers: { "cache-control": "private, max-age=240" } });
    const obj = await s.get(file.storageKey);
    if (!obj) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(Buffer.from(obj.body), {
      headers: {
        "content-type": file.contentType,
        "cache-control": "private, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof DomainError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
