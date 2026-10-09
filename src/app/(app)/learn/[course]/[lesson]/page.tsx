import { ArrowLeft, ArrowRight, Check, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Card, cx, Progress, Prose } from "@/components/ui";
import { DomainError } from "@/server/errors";
import { getCourse } from "@/server/learning";
import { requireUser } from "@/server/session";
import { CompleteButton } from "./complete-button";

export default async function LessonPage(props: PageProps<"/learn/[course]/[lesson]">) {
  const user = await requireUser();
  const { course, lesson } = await props.params;
  let d;
  try {
    d = getCourse(user, course);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const idx = d.flat.findIndex((l) => l.slug === lesson);
  if (idx < 0) notFound();
  const l = d.flat[idx];
  const prev = d.flat[idx - 1];
  const next = d.flat[idx + 1];
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
        <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Aprender</Link>
        <Card className="p-4">
          <h2 className="font-display text-lg font-semibold">{d.course.title}</h2>
          <div className="mt-3 mb-1 flex justify-between text-[12px] text-muted"><span>Progresso</span><span className="tabular">{d.completed}/{d.flat.length}</span></div>
          <Progress value={(d.completed / d.flat.length) * 100} />
          <nav className="mt-4 space-y-4">
            {d.outline.map((m) => (
              <div key={m.id}>
                <div className="mb-1 text-[12px] font-semibold tracking-wide text-muted uppercase">{m.title}</div>
                <ul>
                  {m.lessons.map((x) => (
                    <li key={x.id}>
                      <Link href={`/learn/${course}/${x.slug}`} aria-current={x.slug === lesson ? "page" : undefined} className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", x.slug === lesson ? "bg-sunken font-medium" : "text-ink-2 hover:bg-sunken/60")}>
                        <span className={cx("grid size-5 shrink-0 place-items-center rounded-full", x.done ? "bg-ok text-white" : "ring-1 ring-line-strong")}>{x.done && <Check className="size-3" />}</span>
                        <span className="truncate">{x.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </Card>
      </aside>
      <Card className="p-6 sm:p-10">
        <div className="flex items-center gap-1.5 text-[13px] text-muted"><Clock className="size-4" /> {l.durationMin} min</div>
        <h1 className="mt-2 font-display text-[30px] leading-tight font-semibold">{l.title}</h1>
        <Prose text={l.content} className="mt-6 max-w-2xl text-[16px]" />
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <CompleteButton lessonId={l.id} done={l.done} />
          <div className="flex gap-2">
            {prev && <ButtonLink href={`/learn/${course}/${prev.slug}`} variant="ghost"><ArrowLeft className="size-4" /> Anterior</ButtonLink>}
            {next && <ButtonLink href={`/learn/${course}/${next.slug}`} variant="secondary">Seguinte <ArrowRight className="size-4" /></ButtonLink>}
          </div>
        </div>
      </Card>
    </div>
  );
}
