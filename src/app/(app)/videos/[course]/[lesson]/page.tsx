import { ArrowLeft, ArrowRight, Check, Clock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, Card, cx, Progress, Prose } from "@/components/ui";
import { VideoPlayer } from "@/components/video";
import { DomainError } from "@/server/errors";
import { getLesson } from "@/server/learning";
import { requireUser } from "@/server/session";
import { CompleteButton } from "./complete-button";

export default async function VideoPage(props: PageProps<"/videos/[course]/[lesson]">) {
  const user = await requireUser();
  const { course, lesson } = await props.params;
  let d;
  try {
    d = await getLesson(user, course, lesson);
  } catch (e) {
    if (e instanceof DomainError && e.code === "forbidden") redirect(`/videos/${course}`);
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const l = d.lesson;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <Link href={`/videos/${course}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> {d.course.title}</Link>
        <VideoPlayer url={l.videoUrl} title={l.title} />
        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-1.5 text-[13px] text-muted"><Clock className="size-4" /> {l.durationMin} min</div>
          <h1 className="mt-1 font-display text-[26px] leading-tight font-semibold sm:text-[30px]">{l.title}</h1>
          {l.content && <Prose text={l.content} className="mt-4 max-w-2xl text-[15px]" />}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <CompleteButton lessonId={l.id} done={l.done} />
            <div className="flex gap-2">
              {d.prev && <ButtonLink href={`/videos/${course}/${d.prev.slug}`} variant="ghost"><ArrowLeft className="size-4" /> Anterior</ButtonLink>}
              {d.next && <ButtonLink href={`/videos/${course}/${d.next.slug}`} variant="secondary">Seguinte <ArrowRight className="size-4" /></ButtonLink>}
            </div>
          </div>
        </Card>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="p-4">
          <h2 className="font-display text-base font-semibold">{d.course.title}</h2>
          <div className="mt-2 mb-1 flex justify-between text-[12px] text-muted"><span>Vistos</span><span className="tabular">{d.completed}/{d.flat.length}</span></div>
          <Progress value={(d.completed / d.flat.length) * 100} />
          <nav className="mt-4 space-y-4" aria-label="Vídeos da colecção">
            {d.outline.filter((m) => m.lessons.length).map((m) => (
              <div key={m.id}>
                <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{m.title}</div>
                <ul>
                  {m.lessons.map((x) => (
                    <li key={x.id}>
                      <Link href={`/videos/${course}/${x.slug}`} aria-current={x.slug === lesson ? "page" : undefined} className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", x.slug === lesson ? "bg-sunken font-medium" : "text-ink-2 hover:bg-sunken/60")}>
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
    </div>
  );
}
