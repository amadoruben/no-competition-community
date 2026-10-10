import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { ACCESS_LABEL } from "@/lib/labels";
import { plural } from "@/lib/format";
import { getCourse, listCourses } from "@/server/learning";
import { requireUser } from "@/server/session";
import { AccessSelect, DeleteCollection, DeleteVideo, NewCollectionForm, NewVideoForm } from "./forms";

export const metadata: Metadata = { title: "Gerir vídeos" };

export default async function AdminVideosPage() {
  const user = await requireUser(["investor"]);
  const collections = await listCourses(user);
  const details = await Promise.all(collections.map((c) => getCourse(user, c.slug)));
  return (
    <div className="space-y-6">
      <PageHeader title="Gerir vídeos" description="Colecções de conteúdos exclusivos. Os vídeos ficam alojados no YouTube, Vimeo ou num link .mp4; aqui decide quem os vê." />
      <Notice tone="info">
        <strong>Acesso completo</strong> é atribuído a cada membro em <Link href="/admin/people" className="font-medium underline">Membros e acessos</Link>. Ainda não existem pagamentos: nada é cobrado nem prometido aos membros.
      </Notice>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          {details.length === 0 && (
            <Card className="p-6 text-sm text-ink-2">Ainda não há colecções. Crie a primeira ao lado — por exemplo “Bastidores” ou “Episódios”.</Card>
          )}
          {details.map((d) => (
            <Card key={d.course.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/videos/${d.course.slug}`} className="truncate font-display text-lg font-semibold hover:underline">{d.course.title}</Link>
                    <Badge tone={d.course.accessTier === "full" ? "dark" : "neutral"} className="h-5 px-2 text-[11px]">{ACCESS_LABEL[d.course.accessTier]}</Badge>
                  </div>
                  <p className="text-[13px] text-muted">{plural(d.flat.length, "vídeo", "vídeos")}</p>
                </div>
                <div className="flex items-center gap-1">
                  <AccessSelect courseId={d.course.id} tier={d.course.accessTier} />
                  <DeleteCollection courseId={d.course.id} title={d.course.title} count={d.flat.length} />
                </div>
              </div>
              {d.flat.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Sem vídeos. Adicione o primeiro no formulário “Novo vídeo”.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {d.outline.flatMap((m) =>
                    m.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="w-24 shrink-0 truncate text-[12px] text-muted">{m.title}</span>
                        <Link href={`/videos/${d.course.slug}/${l.slug}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{l.title}</Link>
                        {l.videoUrl && (
                          <a href={l.videoUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" aria-label="Abrir original">
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                        <DeleteVideo lessonId={l.id} title={l.title} />
                      </li>
                    )),
                  )}
                </ul>
              )}
            </Card>
          ))}
        </div>
        <aside className="space-y-4">
          {collections.length > 0 && (
            <Card>
              <CardHeader title="Novo vídeo" />
              <div className="p-5">
                <NewVideoForm collections={collections.map((c) => ({ id: c.id, title: c.title }))} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Nova colecção" />
            <div className="p-5">
              <NewCollectionForm />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
