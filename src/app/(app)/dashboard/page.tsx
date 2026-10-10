import { ArrowRight, CircleAlert, MessagesSquare, PlayCircle, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PersonLine, PhaseBadge, phaseTimeline, PostCard, RankMedal } from "@/components/domain";
import { FirstSteps } from "@/components/first-steps";
import { ButtonLink, Card, CardHeader, cx, EmptyState, FilterChips, Notice, Pagination } from "@/components/ui";
import { VideoThumb } from "@/components/video";
import type { PostKind } from "@/db/schema";
import { challengePhase } from "@/lib/challenge-state";
import { listChallenges } from "@/server/challenges";
import { listFeed } from "@/server/community";
import { memberDashboard } from "@/server/dashboard";
import { latestVideos } from "@/server/learning";
import { requireUser } from "@/server/session";
import { Composer } from "../community/composer";

export const metadata: Metadata = { title: "Início" };

const FILTERS: { key: string; label: string; kind?: PostKind }[] = [
  { key: "all", label: "Tudo" },
  { key: "announcement", label: "Oficial", kind: "announcement" },
  { key: "discussion", label: "Conversas", kind: "discussion" },
  { key: "question", label: "Perguntas", kind: "question" },
  { key: "progress", label: "Progresso", kind: "progress" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
}

/** Início: the community feed, for every role. Members also get their first steps and to-dos. */
export default async function Home(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  const page = Number(sp.page) || 1;
  const [feed, challengeList, videos, d] = await Promise.all([
    listFeed(user, { kind: f.kind, page }),
    listChallenges(user),
    latestVideos(user, 3),
    user.role === "member" ? memberDashboard(user) : null,
  ]);
  const challenges = challengeList.filter((c) => c.status !== "draft");
  const live = challenges.map((c) => ({ ...c, phase: challengePhase(c) })).filter((c) => c.phase === "open" || c.phase === "upcoming");

  const steps = d && [
    { done: !!(user.headline || user.bio || user.avatarFileId), title: "Completar o perfil", detail: "Uma foto e uma linha sobre si: é assim que a comunidade o conhece.", href: "/settings", cta: "Editar perfil" },
    { done: d.hasPosted, title: "Apresentar-se à comunidade", detail: "Uma publicação curta: quem é e o que o trouxe à No Competition.", href: "#publicar", cta: "Publicar" },
    { done: d.hasWatched, title: "Ver um vídeo exclusivo", detail: "Episódios, bastidores e ensinamentos da No Competition.", href: "/videos", cta: "Ver vídeos" },
    { done: d.mine.length > 0, title: "Entrar num desafio", detail: "Leia as regras e os critérios, inscreva-se e submeta antes do prazo.", href: "/challenges", cta: "Ver desafios" },
  ];
  const setupDone = !steps || steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      {sp.welcome && setupDone && <Notice tone="ok">Conta criada. Bem-vindo à comunidade No Competition.</Notice>}
      <div>
        <p className="text-sm text-muted">{greeting()},</p>
        <h1 className="font-display text-[30px] leading-tight font-semibold">{user.name.split(" ")[0]}</h1>
      </div>

      {steps && <FirstSteps title="Bem-vindo à comunidade" steps={steps} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <div id="publicar" className="scroll-mt-20">
            <Composer name={user.name} hue={user.avatarHue} canAnnounce={user.role === "investor"} challenges={challenges.map((c) => ({ id: c.id, title: c.title }))} />
          </div>
          <FilterChips label="Filtrar publicações" active={f.key} items={FILTERS.map((x) => ({ key: x.key, label: x.label, href: x.key === "all" ? "/dashboard" : `/dashboard?f=${x.key}` }))} />
          {feed.items.length === 0 ? (
            <Card>
              <EmptyState icon={<MessagesSquare className="size-5" />} title={f.kind ? "Nada nesta categoria" : "A conversa começa consigo"}>
                {f.kind ? "Experimente outro filtro." : user.role === "investor" ? "Publique um anúncio oficial de boas-vindas: aparece fixado no topo para todos." : "Apresente-se: diga quem é e o que está a construir."}
              </EmptyState>
            </Card>
          ) : (
            feed.items.map((item) => <PostCard key={item.post.id} item={item} viewer={user} />)
          )}
          <Pagination page={feed.page} pages={feed.pages} href={(n) => `/dashboard?${new URLSearchParams({ ...(f.kind ? { f: f.key } : {}), page: String(n) })}`} />
        </div>

        <aside className="space-y-4">
          {d && d.todos.length > 0 && (
            <Card>
              <CardHeader title="Para si" />
              <ul className="divide-y divide-line/70">
                {d.todos.slice(0, 4).map((t) => (
                  <li key={t.key}>
                    <Link href={t.href} className="group flex items-center gap-3 px-5 py-3 hover:bg-sunken/50">
                      <CircleAlert className={cx("size-4 shrink-0", t.urgent ? "text-warn" : "text-muted")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className={cx("block text-[12px]", t.urgent ? "text-warn" : "text-muted")}>{t.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Desafios" action={<ButtonLink href="/challenges" variant="ghost" size="sm">Ver todos</ButtonLink>} />
            {live.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Sem desafios abertos neste momento. Os próximos são anunciados aqui e no feed.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {live.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link href={`/challenges/${c.slug}`} className="group flex items-start gap-3 px-5 py-3 hover:bg-sunken/50">
                      <Zap className="mt-0.5 size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium group-hover:underline">{c.title}</span>
                        <span className="block text-[12px] text-muted">{phaseTimeline(c, c.phase)}</span>
                      </span>
                      <PhaseBadge phase={c.phase} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {videos.length > 0 && (
            <Card>
              <CardHeader title="Vídeos recentes" action={<ButtonLink href="/videos" variant="ghost" size="sm">Biblioteca</ButtonLink>} />
              <ul className="space-y-3 px-5 pb-5">
                {videos.map((v) => (
                  <li key={v.id}>
                    <Link href={`/videos/${v.courseSlug}/${v.slug}`} className="group flex items-center gap-3">
                      <VideoThumb thumbnail={v.thumbnail} hue={210} className="w-24 shrink-0 rounded-lg [&>span]:size-7 [&>span>svg]:size-4" />
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-medium group-hover:underline">{v.title}</span>
                        <span className="text-[12px] text-muted">{v.courseTitle} · {v.durationMin} min</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {videos.length === 0 && user.role === "investor" && (
            <Card className="p-5 text-sm text-ink-2">
              <PlayCircle className="mb-2 size-5 text-muted" />
              Ainda não há vídeos. <Link href="/admin/videos" className="font-medium underline">Publique o primeiro</Link> — basta o link do YouTube ou Vimeo.
            </Card>
          )}

          {d && d.around.length > 0 && (
            <Card>
              <CardHeader title="Classificação" action={<ButtonLink href="/leaderboard" variant="ghost" size="sm">Ver</ButtonLink>} />
              <ul className="p-2">
                {d.around.map((r) => (
                  <li key={r.userId} className={cx("flex items-center gap-3 rounded-xl px-3 py-2", r.userId === user.id && "bg-volt-soft ring-1 ring-volt-strong/50")}>
                    <RankMedal rank={r.rank} />
                    <div className="min-w-0 flex-1">
                      <PersonLine name={r.name} handle={r.handle} hue={r.avatarHue} size={28} />
                    </div>
                    <span className="tabular text-sm font-semibold">{r.total}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {user.role !== "member" && (
            <ButtonLink href={user.role === "investor" ? "/admin" : "/review"} variant="secondary" className="w-full">
              {user.role === "investor" ? "Abrir a administração" : "Abrir avaliações"} <ArrowRight className="size-4" />
            </ButtonLink>
          )}
        </aside>
      </div>
    </div>
  );
}
