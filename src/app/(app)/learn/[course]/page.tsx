import { redirect, notFound } from "next/navigation";
import { DomainError } from "@/server/errors";
import { getCourse } from "@/server/learning";
import { requireUser } from "@/server/session";

/** Opens the first unfinished lesson. */
export default async function CoursePage(props: PageProps<"/learn/[course]">) {
  const user = await requireUser();
  const { course } = await props.params;
  let d;
  try {
    d = await getCourse(user, course);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const next = d.flat.find((l) => !l.done) ?? d.flat[0];
  if (!next) notFound();
  redirect(`/learn/${course}/${next.slug}`);
}
