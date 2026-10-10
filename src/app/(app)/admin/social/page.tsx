import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlatformTile } from "@/components/social/platform-icon";
import { Card, CardHeader, EmptyState, fileUrl, Notice, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { SOCIAL_PLATFORM_LABEL, socialSource } from "@/lib/social";
import { videoSource } from "@/lib/video";
import { listSocialPosts } from "@/server/social";
import { requireUser } from "@/server/session";
import { SocialForm, SocialItemActions } from "./social-form";

export const metadata: Metadata = { title: "Conteúdos sociais" };

export default async function AdminSocialPage(props: PageProps<"/admin/social">) {
  const user = await requireUser(["investor"]);
  const sp = await props.searchParams;
  const items = await listSocialPosts(user);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Conteúdos sociais"
        description="Partilhe na comunidade publicações do Instagram, TikTok, YouTube e X. Aparecem no Início (filtro “Redes”) e na página pública."
      />
      <Notice tone="info">
        Não há sincronização automática com as redes: cada publicação é escolhida e adicionada aqui. Os vídeos do YouTube tocam no leitor oficial; as restantes abrem a publicação original.
      </Notice>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <Card>
            <CardHeader title="Partilhadas" subtitle={items.length ? `${items.length} ${items.length === 1 ? "publicação" : "publicações"}` : undefined} />
            {items.length === 0 ? (
              <EmptyState title="Ainda nada partilhado">Cole ao lado o link de uma publicação para a mostrar à comunidade.</EmptyState>
            ) : (
              <ul className="divide-y divide-line/70">
                {items.map((it) => {
                  const src = socialSource(it.url);
                  const thumb = it.cover ? fileUrl(it.cover.fileId) : src?.youtubeId ? videoSource(it.url)?.thumbnail : null;
                  return (
                    <li key={it.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-sunken ring-1 ring-line">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- /files URL or provider thumbnail
                          <img src={thumb} alt="" className="size-full object-cover" />
                        ) : (
                          src && <PlatformTile platform={src.platform} size={30} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{it.title || it.caption.slice(0, 80) || "Sem título"}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
                          {src && <span>{SOCIAL_PLATFORM_LABEL[src.platform]}</span>}
                          {src?.creator && <span>· @{src.creator}</span>}
                          <span>· {fmtDate(it.createdAt)}</span>
                          <Link href={`/community/${it.id}`} className="inline-flex items-center gap-1 font-medium text-ink hover:underline">
                            · Ver no feed <ExternalLink className="size-3" />
                          </Link>
                        </p>
                      </div>
                      <SocialItemActions item={{ id: it.id, url: it.url, title: it.title, caption: it.caption, cover: it.cover }} startOpen={sp.edit === it.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <Card className="h-fit p-5">
          <h2 className="font-display text-[16px] font-bold">Partilhar uma publicação</h2>
          <div className="mt-4">
            <SocialForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
