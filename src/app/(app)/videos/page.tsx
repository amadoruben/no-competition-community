import { ArrowRight, Clapperboard, Lock, PlayCircle, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Carousel } from "@/components/carousel";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { VideoCard, VideoThumb } from "@/components/video";
import { plural } from "@/lib/format";
import { LOCKED_MESSAGE, listCourses } from "@/server/learning";
import { isInvestor } from "@/server/permissions";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Vídeos" };

type Collection = Awaited<ReturnType<typeof listCourses>>[number];

const size = (c: Collection) => `${plural(c.lessonCount, "vídeo", "vídeos")} · ${c.minutes} min`;

function AccessBadge({ c }: { c: Collection }) {
  if (c.accessTier !== "full") return <Badge className="h-5 px-2 text-[11px]">Aberto a todos</Badge>;
  return (
    <Badge tone={c.locked ? "dark" : "gold"} className="h-5 px-2 text-[11px]">
      <Lock className="size-3" /> Exclusivo
    </Badge>
  );
}

export default async function VideosPage() {
  const user = await requireUser();
  const admin = isInvestor(user);
  const collections = (await listCourses(user)).filter((c) => c.lessonCount > 0 || admin);
  const available = collections.filter((c) => !c.locked);
  const locked = collections.filter((c) => c.locked);
  // "Continue watching": the first unwatched video of a collection already started.
  const started = available.find((c) => c.completed > 0 && c.completed < c.videos.length);
  const resume = started && { c: started, v: started.videos.find((v) => !v.done)! };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Vídeos"
        description="Episódios, bastidores e ensinamentos da No Competition, organizados por colecção."
        actions={admin && <ButtonLink href="/admin/videos" variant="secondary"><Settings2 className="size-4" /> Gerir vídeos</ButtonLink>}
      />

      {collections.length === 0 && (
        <Card>
          <EmptyState
            icon={<Clapperboard />}
            title={admin ? "A biblioteca está vazia" : "Os primeiros vídeos estão a caminho"}
            action={admin && <ButtonLink href="/admin/videos" variant="accent">Publicar o primeiro vídeo</ButtonLink>}
          >
            {admin ? "Crie uma colecção e cole o link de um vídeo do YouTube, Vimeo ou de um ficheiro .mp4." : "Quando a equipa No Competition publicar conteúdos, aparecem aqui."}
          </EmptyState>
        </Card>
      )}

      {resume && (
        <Link href={`/videos/${resume.c.slug}/${resume.v.slug}`} className="group block rounded-[22px]">
          <div className="grid overflow-hidden rounded-[22px] bg-gold-soft shadow-[var(--shadow-card)] ring-1 ring-gold-line sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <VideoThumb thumbnail={resume.v.thumbnail} hue={resume.c.coverHue} seed={resume.v.slug} theme={`${resume.c.title} ${resume.v.title}`} duration={resume.v.durationMin} />
            <div className="flex flex-col justify-center p-5 sm:p-8">
              <p className="eyebrow">Continuar a ver</p>
              <h2 className="mt-2 font-display text-[22px] leading-tight font-bold group-hover:underline sm:text-[26px]">{resume.v.title}</h2>
              <p className="mt-1 text-[14px] text-ink-2">{resume.c.title}</p>
              <div className="mt-5 max-w-xs">
                <div className="mb-1.5 flex justify-between text-[12px] text-muted">
                  <span>Vistos</span>
                  <span className="tabular">{resume.c.completed}/{resume.c.videos.length}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${(resume.c.completed / resume.c.videos.length) * 100}%` }} />
                </div>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition group-hover:bg-gold-hover">
                <PlayCircle className="size-4" /> Continuar
              </span>
            </div>
          </div>
        </Link>
      )}

      {available.map((c) => {
        const subtitle = (
          <span className="flex flex-wrap items-center gap-2">
            <AccessBadge c={c} />
            <span>{size(c)}</span>
            {c.completed > 0 && <span>· {c.completed === c.videos.length ? "tudo visto" : `${c.completed} vistos`}</span>}
            {c.description && <span className="mt-0.5 block w-full max-w-2xl text-[13px] text-muted">{c.description}</span>}
          </span>
        );
        const more = (
          <Link href={`/videos/${c.slug}`} className="inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap hover:underline">
            Ver colecção <ArrowRight className="size-4" />
          </Link>
        );
        if (!c.videos.length)
          return (
            <section key={c.id} aria-labelledby={`col-${c.slug}`}>
              <SectionTitle id={`col-${c.slug}`} title={c.title} subtitle={subtitle} />
              <Card>
                <EmptyState compact title="Colecção sem vídeos" action={admin && <ButtonLink href="/admin/videos" variant="secondary" size="sm">Adicionar vídeos</ButtonLink>}>
                  Só a administração vê colecções vazias.
                </EmptyState>
              </Card>
            </section>
          );
        return (
          <Carousel key={c.id} title={c.title} subtitle={subtitle} action={more} itemClassName="w-[72%] sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]">
            {c.videos.map((v, i) => (
              <VideoCard key={v.id} href={`/videos/${c.slug}/${v.slug}`} title={v.title} thumbnail={v.thumbnail} hue={c.coverHue} seed={v.slug} theme={`${c.title} ${v.title}`} duration={v.durationMin} done={v.done} eyebrow={`Vídeo ${i + 1}`} number={i + 1} />
            ))}
          </Carousel>
        );
      })}

      {locked.length > 0 && (
        <section aria-labelledby="sec-exclusive">
          <SectionTitle id="sec-exclusive" title="Exclusivos" subtitle={LOCKED_MESSAGE} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((c) => (
              <Link key={c.id} href={`/videos/${c.slug}`} className="group block h-full rounded-[var(--radius-card)]">
                <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/80 transition group-hover:shadow-[var(--shadow-pop)]">
                  <VideoThumb thumbnail={null} hue={c.coverHue} seed={c.slug} theme={c.title} locked />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      <AccessBadge c={c} /> {size(c)}
                    </div>
                    <h3 className="mt-2 font-display text-[17px] leading-snug font-semibold group-hover:underline">{c.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-2">{c.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

