import { Bookmark, CircleAlert, Gauge, MessagesSquare, PlayCircle, Plus, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { CoverArt, CoverTile, glyphFor } from "@/components/cover-art";
import { PersonLine, PhaseBadge, phaseTimeline, RankMedal } from "@/components/domain";
import { Composer } from "@/components/feed/composer";
import { PostCard } from "@/components/feed/post-card";
import { FirstSteps } from "@/components/first-steps";
import { Avatar, ButtonLink, Card, CardHeader, cx, EmptyState, FilterChips, Notice, Pagination } from "@/components/ui";
import { VideoThumb } from "@/components/video";
import type { PostKind } from "@/db/schema";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { plural } from "@/lib/format";
import { listChallenges } from "@/server/challenges";
import { listFeed } from "@/server/community";
import { communityStats, memberDashboard } from "@/server/dashboard";
import { latestVideos } from "@/server/learning";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Início" };

const FILTERS: { key: string; label: string; kind?: PostKind; saved?: true }[] = [
  { key: "all", label: "Tudo" },
  { key: "announcement", label: "Oficiais", kind: "announcement" },
  { key: "discussion", label: "Conversas", kind: "discussion" },
  { key: "question", label: "Perguntas", kind: "question" },
  { key: "progress", label: "Progresso", kind: "progress" },
  { key: "saved", label: "Guardados", saved: true },
];

/** Challenges shown first: what members can act on now. */
const PHASE_ORDER: ChallengePhase[] = ["open", "upcoming", "paused", "reviewing", "results"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
}

/**
 * Início is the community feed. Phones and tablets get the feed first, with
 * the challenges as a compact strip; wide screens add a side column with
 * challenges, deadlines, videos, the team and the ranking.
 */
export default async function Home(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  const page = Number(sp.page) || 1;
  const [feed, challengeList, videos, stats, d] = await Promise.all([
    listFeed(user, { kind: f.kind, saved: f.saved, page }),
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
    .slice(0, 6);
  const live = ranked.filter((c) => c.phase === "open" || c.phase === "upcoming");
  const openCount = ranked.filter((c) => c.phase === "open").length;

  const steps = d && [
    { done: !!(user.headline || user.bio || user.avatarFileId), title: "Completar o perfil", detail: "Uma foto e uma linha sobre si.", href: "/settings", cta: "Editar perfil" },
    { done: d.hasPosted, title: "Apresentar-se à comunidade", detail: "Quem é e o que o trouxe.", href: "#publicar", cta: "Publicar" },
    { done: d.hasWatched, title: "Ver um vídeo exclusivo", detail: "Episódios e bastidores.", href: "/videos", cta: "Ver vídeos" },
    { done: d.mine.length > 0, title: "Entrar num desafio", detail: "Inscreva-se e submeta.", href: "/challenges", cta: "Ver desafios" },
  ];
  const setupDone = !steps || steps.every((s) => s.done);
  const viewer = { id: user.id, role: user.role };

  return (
    <div className="mx-auto grid max-w-[1040px] grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
      <div className="mx-auto w-full max-w-[680px] min-w-0 space-y-4 sm:space-y-5">
        {sp.welcome && setupDone && <Notice tone="ok">Conta criada. Bem-vindo à comunidade No Competition.</Notice>}

        <section aria-labelledby="community-title" className="relative overflow-hidden rounded-[20px] bg-ink text-white">
          <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[46%] sm:block">
            <CoverArt hue={80} seed="no-competition" tone="brand" className="size-full" />
          </div>
          <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[46%] bg-gradient-to-r from-ink via-ink/50 to-transparent sm:block" />
          <div className="relative flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-6">
            <BrandMark size={52} className="shrink-0 rounded-[15px] ring-1 ring-white/15" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-volt uppercase">Comunidade oficial</p>
              <h1 id="community-title" className="font-display text-[19px] leading-tight font-semibold sm:text-[26px]">
                No Competition Community
              </h1>
              <p className="mt-0.5 truncate text-[13px] text-white/70 sm:text-[14px]">
                {greeting()}, {user.name.split(" ")[0]} · {plural(stats.members, "membro", "membros")}
              </p>
            </div>
          </div>
        </section>

        {live.length > 0 && (
          <section aria-labelledby="strip-title" className="lg:hidden">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="strip-title" className="text-[14px] font-semibold">
                Desafios {openCount > 0 && <span className="font-normal text-muted">· {plural(openCount, "aberto", "abertos")}</span>}
              </h2>
              <Link href="/challenges" className="text-[13px] font-medium text-ink-2 hover:text-ink hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {live.map((c) => (
                <li key={c.id} className="w-[min(78%,300px)] shrink-0 snap-start">
                  <ChallengeRow c={c} card />
                </li>
              ))}
            </ul>
          </section>
        )}

        <Composer
          name={user.name}
          hue={user.avatarHue}
          fileId={user.avatarFileId}
          canAnnounce={user.role === "investor"}
          challenges={challenges.filter((c) => challengePhase(c) !== "results").map((c) => ({ id: c.id, title: c.title }))}
        />

        <FilterChips
          label="Filtrar publicações"
          active={f.key}
          items={FILTERS.map((x) => ({ key: x.key, label: x.label, href: x.key === "all" ? "/dashboard" : `/dashboard?f=${x.key}` }))}
        />

        {feed.items.length === 0 ? (
          <Card>
            <EmptyState
              icon={f.saved ? <Bookmark /> : <MessagesSquare />}
              title={f.saved ? "Ainda não guardou publicações" : f.kind ? "Nada nesta categoria ainda" : "A conversa começa consigo"}
            >
              {f.saved
                ? "Toque no marcador por baixo de uma publicação para a guardar aqui."
                : f.kind
                  ? "Experimente outro filtro ou publique nesta categoria."
                  : user.role === "investor"
                    ? "Publique um anúncio oficial de boas-vindas: fica fixado no topo do Início de todos os membros."
                    : "Apresente-se: diga quem é e o que está a construir."}
            </EmptyState>
          </Card>
        ) : (
          <div className="space-y-2 sm:space-y-5">
            {feed.items.map((item) => (
              <PostCard key={item.post.id} item={item} viewer={viewer} />
            ))}
          </div>
        )}
        <Pagination page={feed.page} pages={feed.pages} href={(n) => `/dashboard?${new URLSearchParams({ ...(f.key !== "all" ? { f: f.key } : {}), page: String(n) })}`} />
      </div>

      <aside className="hidden space-y-5 lg:sticky lg:top-24 lg:block lg:self-start" aria-label="Na comunidade">
        {steps && !setupDone && <FirstSteps compact title="Bem-vindo à comunidade" steps={steps} />}

        {ranked.length > 0 ? (
          <Card>
            <CardHeader
              title="Desafios"
              action={
                <Link href="/challenges" className="text-[13px] font-medium underline-offset-4 hover:underline">
                  Ver todos
                </Link>
              }
            />
            <ul className="p-2">
              {ranked.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <ChallengeRow c={c} />
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<Zap />}
              title="Ainda sem desafios"
              action={
                user.role === "investor" && (
                  <ButtonLink href="/admin/challenges/new" variant="accent" size="sm">
                    <Plus className="size-4" /> Criar desafio
                  </ButtonLink>
                )
              }
            >
              {user.role === "investor" ? "Fica em rascunho até o publicar." : "Os desafios aparecem aqui quando forem lançados."}
            </EmptyState>
          </Card>
        )}

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
            <CardHeader
              title="Vídeos recentes"
              action={
                <Link href="/videos" className="text-[13px] font-medium underline-offset-4 hover:underline">
                  Biblioteca
                </Link>
              }
            />
            <ul className="space-y-3 p-4">
              {videos.map((v) => (
                <li key={v.id}>
                  <Link href={`/videos/${v.courseSlug}/${v.slug}`} className="group flex items-center gap-3">
                    <VideoThumb thumbnail={v.thumbnail} hue={210} seed={v.slug} theme={v.courseTitle} small className="w-28 shrink-0 rounded-lg" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[13.5px] leading-snug font-medium group-hover:underline">{v.title}</span>
                      <span className="text-[12px] text-muted">
                        {v.durationMin} min · {v.courseTitle}
                      </span>
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
                Ainda não há vídeos.{" "}
                <Link href="/admin/videos" className="font-medium text-ink underline">
                  Publique o primeiro
                </Link>{" "}
                — basta o link do YouTube ou do Vimeo.
              </p>
            </Card>
          )
        )}

        {stats.team.length > 0 && (
          <Card>
            <CardHeader title="Equipa No Competition" />
            <ul className="space-y-1 p-2">
              {stats.team.map((t) => (
                <li key={t.id}>
                  <Link href={`/members/${t.handle}`} className="group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-sunken/60">
                    <Avatar name={t.name} hue={t.avatarHue} fileId={t.avatarFileId} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold group-hover:underline">{t.name}</span>
                      <span className="block truncate text-[12px] text-muted">{t.headline || "Conta oficial"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {d && d.around.length > 0 && (
          <Card>
            <CardHeader
              title="Classificação"
              action={
                <Link href="/leaderboard" className="text-[13px] font-medium underline-offset-4 hover:underline">
                  Ver tudo
                </Link>
              }
            />
            <ol className="p-2">
              {d.around.map((r) => (
                <li key={r.userId} className={cx("flex items-center gap-3 rounded-xl px-3 py-2", r.userId === user.id && "bg-volt-soft")}>
                  <RankMedal rank={r.rank} />
                  <div className="min-w-0 flex-1">
                    <PersonLine name={r.name} handle={r.handle} hue={r.avatarHue} fileId={r.avatarFileId} size={28} />
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
  );
}

/** A challenge as one compact row (side column) or a small card (strip on phones and tablets). */
function ChallengeRow({ c, card }: { c: Awaited<ReturnType<typeof listChallenges>>[number] & { phase: ChallengePhase }; card?: boolean }) {
  return (
    <Link
      href={`/challenges/${c.slug}`}
      className={cx("group flex items-center gap-3", card ? "h-full rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)] ring-1 ring-line/80" : "rounded-xl px-3 py-2.5 hover:bg-sunken/60")}
    >
      <CoverTile hue={c.coverHue} glyph={glyphFor(c.category, c.title)} className="grid size-12 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13.5px] leading-snug font-semibold group-hover:underline">{c.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          <PhaseBadge phase={c.phase} />
          <span>{phaseTimeline(c, c.phase)}</span>
        </span>
      </span>
    </Link>
  );
}
