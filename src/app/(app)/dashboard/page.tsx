import { ArrowRight, CircleAlert, Gauge, MessagesSquare, Pin, PlayCircle, Plus, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Carousel } from "@/components/carousel";
import { PostActions } from "@/components/post-actions";
import { CoverArt } from "@/components/cover-art";
import { ChallengeCard, PersonLine, PostCard, RankMedal } from "@/components/domain";
import { FirstSteps } from "@/components/first-steps";
import { Avatar, ButtonLink, Card, CardHeader, cx, EmptyState, FilterChips, Notice, Pagination } from "@/components/ui";
import { VideoThumb } from "@/components/video";
import type { PostKind } from "@/db/schema";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { plural, timeAgo } from "@/lib/format";
import { listChallenges } from "@/server/challenges";
import { listFeed } from "@/server/community";
import { communityStats, memberDashboard } from "@/server/dashboard";
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

/** Which challenges the home carousel shows first: what members can act on now. */
const PHASE_ORDER: ChallengePhase[] = ["open", "upcoming", "paused", "reviewing", "results"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
}

/** Início: the community itself — identity, what is official, the challenges and the conversation. */
export default async function Home(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  const page = Number(sp.page) || 1;
  const [feed, challengeList, videos, stats, d] = await Promise.all([
    listFeed(user, { kind: f.kind, page }),
    listChallenges(user),
    latestVideos(user, 3),
    communityStats(user),
    user.role === "member" ? memberDashboard(user) : null,
  ]);
  const challenges = challengeList.filter((c) => c.status !== "draft");
  const ranked = challenges
    .map((c) => ({ ...c, phase: challengePhase(c) }))
    .filter((c) => PHASE_ORDER.includes(c.phase))
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || +a.submissionDeadline - +b.submissionDeadline)
    .slice(0, 8);
  const openCount = ranked.filter((c) => c.phase === "open").length;

  // The latest pinned announcement is featured above everything; it is not repeated in the feed.
  const featured = f.key === "all" && page === 1 ? feed.items.find((i) => i.post.pinned && i.post.kind === "announcement") : undefined;
  const posts = featured ? feed.items.filter((i) => i !== featured) : feed.items;

  const steps = d && [
    { done: !!(user.headline || user.bio || user.avatarFileId), title: "Completar o perfil", detail: "Uma foto e uma linha sobre si.", href: "/settings", cta: "Editar perfil" },
    { done: d.hasPosted, title: "Apresentar-se à comunidade", detail: "Quem é e o que o trouxe.", href: "#publicar", cta: "Publicar" },
    { done: d.hasWatched, title: "Ver um vídeo exclusivo", detail: "Episódios e bastidores.", href: "/videos", cta: "Ver vídeos" },
    { done: d.mine.length > 0, title: "Entrar num desafio", detail: "Inscreva-se e submeta.", href: "/challenges", cta: "Ver desafios" },
  ];
  const setupDone = !steps || steps.every((s) => s.done);

  return (
    <div className="space-y-8">
      {sp.welcome && setupDone && <Notice tone="ok">Conta criada. Bem-vindo à comunidade No Competition.</Notice>}

      <section aria-labelledby="community-title" className="relative overflow-hidden rounded-[22px] bg-ink text-white">
        <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[52%] sm:block">
          <CoverArt hue={80} seed="no-competition" tone="brand" className="size-full" />
        </div>
        <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[52%] bg-gradient-to-r from-ink via-ink/40 to-transparent sm:block" />
        <div className="relative max-w-xl px-5 py-5 sm:px-8 sm:py-8">
          <p className="text-[12px] font-semibold tracking-[0.12em] text-volt uppercase">Comunidade oficial</p>
          <h1 id="community-title" className="mt-1.5 font-display text-[24px] leading-[1.08] font-semibold sm:mt-2 sm:text-[36px]">
            No Competition Community
          </h1>
          <p className="mt-2 text-[14px] text-white/70 sm:text-[15px]">
            {greeting()}, {user.name.split(" ")[0]}. Conteúdos exclusivos, conversas e desafios — num só lugar.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] sm:mt-5">
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium">{plural(stats.members, "membro", "membros")}</span>
            {openCount > 0 && (
              <Link href="/challenges" className="inline-flex items-center gap-1.5 rounded-full bg-volt px-3 py-1.5 font-semibold text-ink hover:bg-volt-strong">
                <Zap className="size-3.5" /> {plural(openCount, "desafio aberto", "desafios abertos")}
              </Link>
            )}
            <Link href="/videos" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20">
              <PlayCircle className="size-3.5" /> Vídeos
            </Link>
          </div>
        </div>
      </section>

      {featured && (
        <article className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-line/80 sm:p-6">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-volt" />
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold tracking-wide text-ink uppercase">
            <Pin className="size-3.5" /> Anúncio oficial
          </div>
          <Link href={`/community/${featured.post.id}`} className="group mt-2 block">
            <h2 className="font-display text-[19px] leading-snug font-semibold group-hover:underline sm:text-[24px]">{featured.post.title}</h2>
            <p className="mt-1.5 line-clamp-2 max-w-3xl text-[15px] leading-relaxed text-ink-2 sm:line-clamp-3">{featured.post.body}</p>
          </Link>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-muted">
              <Avatar name={featured.authorName} hue={featured.authorHue} fileId={featured.authorAvatar} size={26} />
              {featured.authorName} · {timeAgo(featured.post.createdAt)} · {plural(featured.commentCount, "comentário", "comentários")}
            </span>
            <div className="flex items-center gap-1">
              {(user.role === "investor" || user.id === featured.post.authorId) && (
                <PostActions postId={featured.post.id} pinned={featured.post.pinned} canPin={user.role === "investor"} canDelete />
              )}
              <ButtonLink href={`/community/${featured.post.id}`} variant="secondary" size="sm">
                Ler anúncio <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          </div>
        </article>
      )}

      {ranked.length > 0 ? (
        <Carousel
          title="Desafios"
          subtitle={openCount > 0 ? `${plural(openCount, "desafio", "desafios")} com inscrições abertas` : "Próximos desafios e resultados"}
          action={
            <Link href="/challenges" className="text-[13px] font-medium text-ink underline-offset-4 hover:underline">
              Ver todos
            </Link>
          }
        >
          {ranked.map((c) => (
            <ChallengeCard key={c.id} c={c} />
          ))}
        </Carousel>
      ) : (
        <Card>
          <EmptyState
            compact
            icon={<Zap />}
            title="Ainda não há desafios publicados"
            action={user.role === "investor" && <ButtonLink href="/admin/challenges/new" variant="accent"><Plus className="size-4" /> Criar o primeiro desafio</ButtonLink>}
          >
            {user.role === "investor" ? "Defina tema, regras, critérios e prémios. Fica em rascunho até o publicar." : "Quando a No Competition lançar um desafio, aparece aqui com as regras, o prazo e os prémios."}
          </EmptyState>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <h2 className="font-display text-[20px] font-semibold">Comunidade</h2>
          <div id="publicar" className="scroll-mt-24">
            <Composer name={user.name} hue={user.avatarHue} canAnnounce={user.role === "investor"} challenges={challenges.map((c) => ({ id: c.id, title: c.title }))} />
          </div>
          <FilterChips label="Filtrar publicações" active={f.key} items={FILTERS.map((x) => ({ key: x.key, label: x.label, href: x.key === "all" ? "/dashboard" : `/dashboard?f=${x.key}` }))} />
          {posts.length === 0 ? (
            <Card>
              <EmptyState icon={<MessagesSquare />} title={f.kind ? "Nada nesta categoria ainda" : featured ? "Seja o primeiro a responder" : "A conversa começa consigo"}>
                {f.kind
                  ? "Experimente outro filtro ou publique na categoria."
                  : user.role === "investor"
                    ? "Publique um anúncio oficial de boas-vindas: fica em destaque no topo do Início de todos os membros."
                    : "Apresente-se: diga quem é e o que está a construir."}
              </EmptyState>
            </Card>
          ) : (
            posts.map((item) => <PostCard key={item.post.id} item={item} viewer={user} />)
          )}
          <Pagination page={feed.page} pages={feed.pages} href={(n) => `/dashboard?${new URLSearchParams({ ...(f.kind ? { f: f.key } : {}), page: String(n) })}`} />
        </div>

        <aside className="space-y-5" aria-label="Para si">
          {steps && !setupDone && <FirstSteps compact title="Bem-vindo à comunidade" steps={steps} />}

          {d && d.todos.length > 0 && (
            <Card>
              <CardHeader title="Os seus prazos" />
              <ul className="divide-y divide-line/70">
                {d.todos.slice(0, 4).map((t) => (
                  <li key={t.key}>
                    <Link href={t.href} className="group flex items-start gap-3 px-5 py-3 hover:bg-sunken/50">
                      <CircleAlert className={cx("mt-0.5 size-4 shrink-0", t.urgent ? "text-warn" : "text-faint")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug font-medium">{t.title}</span>
                        <span className={cx("block text-[12px]", t.urgent ? "text-warn" : "text-muted")}>{t.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {videos.length > 0 ? (
            <Card>
              <CardHeader title="Vídeos recentes" action={<Link href="/videos" className="text-[13px] font-medium underline-offset-4 hover:underline">Biblioteca</Link>} />
              <ul className="space-y-3 p-4">
                {videos.map((v) => (
                  <li key={v.id}>
                    <Link href={`/videos/${v.courseSlug}/${v.slug}`} className="group flex items-center gap-3">
                      <VideoThumb thumbnail={v.thumbnail} hue={210} seed={v.slug} theme={v.courseTitle} small className="w-28 shrink-0 rounded-lg" />
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-[13.5px] leading-snug font-medium group-hover:underline">{v.title}</span>
                        <span className="text-[12px] text-muted">{v.durationMin} min · {v.courseTitle}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            user.role === "investor" && (
              <Card className="p-5">
                <PlayCircle className="size-5 text-muted" />
                <p className="mt-2 text-sm text-ink-2">
                  Ainda não há vídeos. <Link href="/admin/videos" className="font-medium text-ink underline">Publique o primeiro</Link> — basta o link do YouTube ou do Vimeo.
                </p>
              </Card>
            )
          )}

          {d && d.around.length > 0 && (
            <Card>
              <CardHeader title="Classificação" action={<Link href="/leaderboard" className="text-[13px] font-medium underline-offset-4 hover:underline">Ver tudo</Link>} />
              <ol className="p-2">
                {d.around.map((r) => (
                  <li key={r.userId} className={cx("flex items-center gap-3 rounded-xl px-3 py-2", r.userId === user.id && "bg-volt-soft")}>
                    <RankMedal rank={r.rank} />
                    <div className="min-w-0 flex-1">
                      <PersonLine name={r.name} handle={r.handle} hue={r.avatarHue} size={28} />
                    </div>
                    <span className="tabular text-sm font-semibold">{r.total}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {user.role !== "member" && (
            <ButtonLink href={user.role === "investor" ? "/admin" : "/review"} variant="secondary" className="w-full">
              <Gauge className="size-4" /> {user.role === "investor" ? "Abrir a administração" : "Abrir avaliações"}
            </ButtonLink>
          )}
        </aside>
      </div>
    </div>
  );
}
