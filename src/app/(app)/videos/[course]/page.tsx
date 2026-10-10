import { ArrowLeft, Clapperboard, Lock, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, EmptyState, Progress, SectionTitle } from "@/components/ui";
import { VideoCard, VideoThumb } from "@/components/video";
import { plural } from "@/lib/format";
import { DomainError } from "@/server/errors";
import { getCourse, LOCKED_MESSAGE } from "@/server/learning";
import { requireUser } from "@/server/session";

export async function generateMetadata(props: PageProps<"/videos/[course]">): Promise<Metadata> {
  return { title: (await props.params).course.replace(/-/g, " ") };
}

export default async function CollectionPage(props: PageProps<"/videos/[course]">) {
  const user = await requireUser();
  const { course } = await props.params;
  let d;
  try {
    d = await getCourse(user, course);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const c = d.course;
  const next = d.flat.find((l) => !l.done) ?? d.flat[0];
  const sections = d.outline.filter((m) => m.lessons.length);
  const number = new Map(d.flat.map((l, i) => [l.id, i + 1]));

  return (
    <div className="space-y-8">
      <Link href="/videos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Vídeos
      </Link>

      <section aria-labelledby="collection-title" className="grid overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/80 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <VideoThumb thumbnail={d.locked ? null : (d.flat.find((l) => l.thumbnail)?.thumbnail ?? null)} hue={c.coverHue} seed={c.slug} theme={c.title} locked={d.locked} className="md:aspect-auto md:h-full md:min-h-[240px]" />
        <div className="flex flex-col p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {c.accessTier === "full" ? (
              <Badge tone={d.locked ? "dark" : "volt"} className="h-5 px-2 text-[11px]">
                <Lock className="size-3" /> Exclusivo
              </Badge>
            ) : (
              <Badge className="h-5 px-2 text-[11px]">Aberto a todos</Badge>
            )}
            {d.lessonCount > 0 && <span>{plural(d.lessonCount, "vídeo", "vídeos")} · {d.minutes} min</span>}
          </div>
          <h1 id="collection-title" className="mt-2 font-display text-[26px] leading-[1.1] font-semibold sm:text-[32px]">{c.title}</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">{c.description}</p>
          {d.locked ? (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-sunken p-3.5 text-sm text-ink-2">
              <Lock className="mt-0.5 size-4 shrink-0" /> {LOCKED_MESSAGE}
            </p>
          ) : (
            next && (
              <div className="mt-auto pt-6">
                <div className="mb-1.5 flex max-w-xs justify-between text-[12px] text-muted">
                  <span>{d.completed === d.flat.length ? "Tudo visto" : "Vistos"}</span>
                  <span className="tabular">{d.completed}/{d.flat.length}</span>
                </div>
                <Progress value={(d.completed / d.flat.length) * 100} tone={d.completed === d.flat.length ? "ok" : "ink"} className="max-w-xs" />
                <ButtonLink href={`/videos/${course}/${next.slug}`} variant="accent" className="mt-5">
                  <PlayCircle className="size-4" /> {d.completed === 0 ? "Começar" : d.completed === d.flat.length ? "Ver de novo" : "Continuar"}
                </ButtonLink>
              </div>
            )
          )}
        </div>
      </section>

      {!d.locked && d.flat.length === 0 && (
        <Card>
          <EmptyState icon={<Clapperboard />} title="Sem vídeos nesta colecção">Os vídeos aparecem aqui quando forem publicados.</EmptyState>
        </Card>
      )}

      {sections.map((m) => (
        <section key={m.id} aria-labelledby={`sec-${m.id}`}>
          <SectionTitle id={`sec-${m.id}`} title={sections.length > 1 ? m.title : "Vídeos"} subtitle={plural(m.lessons.length, "vídeo", "vídeos")} />
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {m.lessons.map((l) => (
              <li key={l.id}>
                <VideoCard href={`/videos/${course}/${l.slug}`} title={l.title} thumbnail={l.thumbnail} hue={c.coverHue} seed={l.slug} theme={`${c.title} ${l.title}`} duration={l.durationMin} done={l.done} eyebrow={`Vídeo ${number.get(l.id)}`} number={number.get(l.id)} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
