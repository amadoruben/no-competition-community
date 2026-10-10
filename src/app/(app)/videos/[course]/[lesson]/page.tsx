import { ArrowLeft, ArrowRight, Check, Clock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, Card, cx, Progress, Prose } from "@/components/ui";
import { VideoPlayer, VideoThumb } from "@/components/video";
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <Link href={`/videos/${course}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> {d.course.title}</Link>
        <VideoPlayer url={l.videoUrl} title={l.title} />
        <Card className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span>Vídeo {d.flat.findIndex((x) => x.id === l.id) + 1} de {d.flat.length}</span>
            <span className="flex items-center gap-1.5"><Clock className="size-4" /> {l.durationMin} min</span>
          </div>
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
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-4">
            <Link href={`/videos/${course}`} className="font-display text-base font-semibold hover:underline">{d.course.title}</Link>
            <div className="mt-2 mb-1 flex justify-between text-[12px] text-muted">
              <span>Vistos</span>
              <span className="tabular">{d.completed}/{d.flat.length}</span>
            </div>
            <Progress value={(d.completed / d.flat.length) * 100} tone={d.completed === d.flat.length ? "ok" : "ink"} />
          </div>
          <nav className="max-h-[60vh] space-y-3 overflow-y-auto p-2 lg:max-h-[calc(100vh-15rem)]" aria-label="Vídeos da colecção">
            {d.outline.filter((m) => m.lessons.length).map((m, _, all) => (
              <div key={m.id}>
                {all.length > 1 && <div className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{m.title}</div>}
                <ul>
                  {m.lessons.map((x) => (
                    <li key={x.id}>
                      <Link
                        href={`/videos/${course}/${x.slug}`}
                        aria-current={x.slug === lesson ? "page" : undefined}
                        className={cx("flex items-center gap-3 rounded-xl p-2 text-sm", x.slug === lesson ? "bg-sunken font-medium" : "text-ink-2 hover:bg-sunken/60")}
                      >
                        <VideoThumb thumbnail={x.thumbnail} hue={d.course.coverHue} seed={x.slug} theme={`${d.course.title} ${x.title}`} small className="w-24 shrink-0 rounded-lg" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 leading-snug">{x.title}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                            {x.durationMin} min
                            {x.done && (
                              <span className="inline-flex items-center gap-0.5 text-ok">
                                · <Check className="size-3" strokeWidth={3} /> Visto
                              </span>
                            )}
                          </span>
                        </span>
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
