import { Clapperboard, Lock, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Progress } from "@/components/ui";
import { VideoThumb } from "@/components/video";
import { plural } from "@/lib/format";
import { listCourses } from "@/server/learning";
import { isInvestor } from "@/server/permissions";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Vídeos" };

export default async function VideosPage() {
  const user = await requireUser();
  const collections = (await listCourses(user)).filter((c) => c.lessonCount > 0 || isInvestor(user));
  const admin = isInvestor(user);
  return (
    <div>
      <PageHeader
        title="Vídeos"
        description="Episódios, bastidores e ensinamentos exclusivos da No Competition, organizados por colecção."
        actions={admin && <ButtonLink href="/admin/videos" variant="secondary"><Settings2 className="size-4" /> Gerir vídeos</ButtonLink>}
      />
      {collections.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Clapperboard className="size-5" />}
            title={admin ? "A biblioteca está vazia" : "Os primeiros vídeos estão a caminho"}
            action={admin && <ButtonLink href="/admin/videos" variant="accent">Publicar o primeiro vídeo</ButtonLink>}
          >
            {admin ? "Crie uma colecção e cole o link de um vídeo do YouTube, Vimeo ou de um ficheiro .mp4." : "Quando a equipa No Competition publicar conteúdos, aparecem aqui."}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const pct = c.lessonCount ? (c.completed / c.lessonCount) * 100 : 0;
            return (
              <Link key={c.id} href={`/videos/${c.slug}`} className="group">
                <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-pop)]">
                  <VideoThumb thumbnail={c.thumbnail} hue={c.coverHue} locked={c.locked} />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center gap-2">
                      {c.accessTier === "full" && (
                        <Badge tone={c.locked ? "dark" : "volt"} className="h-5 px-2 text-[11px]">
                          <Lock className="size-3" /> Exclusivo
                        </Badge>
                      )}
                      <span className="text-[12px] text-muted">{c.videoCount === c.lessonCount ? plural(c.lessonCount, "vídeo", "vídeos") : plural(c.lessonCount, "conteúdo", "conteúdos")} · {c.minutes} min</span>
                    </div>
                    <h2 className="mt-1.5 font-display text-lg font-semibold group-hover:underline">{c.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-2">{c.description}</p>
                    {!c.locked && c.lessonCount > 0 && (
                      <div className="mt-auto pt-4">
                        <div className="mb-1.5 flex justify-between text-[12px] text-muted">
                          <span>{c.completed === c.lessonCount ? "Tudo visto" : "Progresso"}</span>
                          <span className="tabular">{c.completed}/{c.lessonCount}</span>
                        </div>
                        <Progress value={pct} tone={pct === 100 ? "ok" : "ink"} />
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
