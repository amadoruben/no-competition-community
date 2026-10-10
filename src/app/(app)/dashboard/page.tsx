import { Bookmark, CircleAlert, Gauge, MessagesSquare, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Carousel } from "@/components/carousel";
import { CommunityCard, HostStrip, type Host } from "@/components/community-card";
import { ChallengeTile, PersonLine, RankMedal } from "@/components/domain";
import { Composer } from "@/components/feed/composer";
import { PostCard } from "@/components/feed/post-card";
import { FirstSteps } from "@/components/first-steps";
import { StoriesBar } from "@/components/stories/stories-bar";
import { storiesFor } from "@/components/stories/server";
import { ButtonLink, Card, CardHeader, cx, EmptyState, FilterChips, Notice, Pagination } from "@/components/ui";
import type { AnyPostKind } from "@/db/schema";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { cleanLinks } from "@/lib/social";
import { listChallenges } from "@/server/challenges";
import { listFeed } from "@/server/community";
import { communityStats, memberDashboard } from "@/server/dashboard";
import { followeeIds } from "@/server/follows";
import { communityHost } from "@/server/members";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Início" };

const FILTERS: { key: string; label: string; kind?: AnyPostKind; saved?: true }[] = [
  { key: "all", label: "Tudo" },
  { key: "announcement", label: "Oficiais", kind: "announcement" },
  { key: "question", label: "Perguntas", kind: "question" },
  { key: "progress", label: "Progresso", kind: "progress" },
  { key: "social", label: "Redes", kind: "social" },
  { key: "saved", label: "Guardados", saved: true },
];

/** Challenges shown first: what members can act on now. */
const PHASE_ORDER: ChallengePhase[] = ["open", "upcoming", "paused", "reviewing", "results"];

/**
 * Início: stories at the top, then writing, the challenges and the feed —
 * with people to follow and videos to watch between posts, as in the social
 * apps members already use. Wide screens add the community card (with its
 * host), first steps, deadlines and the ranking on the side.
 */
export default async function Home(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  const page = Number(sp.page) || 1;
  const [feed, challengeList, stats, d, stories, hostRow, followed] = await Promise.all([
    listFeed(user, { kind: f.kind, saved: f.saved, page }),
    listChallenges(user),
    communityStats(user),
    user.role === "member" ? memberDashboard(user) : null,
    storiesFor(user),
    communityHost(user),
    followeeIds(user.id),
  ]);
  const challenges = challengeList.filter((c) => c.status !== "draft");
  const ranked = challenges
    .map((c) => ({ ...c, phase: challengePhase(c) }))
    .filter((c) => PHASE_ORDER.includes(c.phase))
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || +a.submissionDeadline - +b.submissionDeadline)
    .slice(0, 8);
  const host: Host | null = hostRow && { id: hostRow.id, name: hostRow.name, handle: hostRow.handle, headline: hostRow.headline, avatarHue: hostRow.avatarHue, avatarFileId: hostRow.avatarFileId, links: cleanLinks(hostRow.socialLinks) };
  const followsHost = !!host && followed.includes(host.id);
  const hostFirst = host?.name.split(" ")[0];

  const steps = d && [
    { done: !!(user.headline || user.bio || user.avatarFileId), title: "Completar o perfil", detail: "Uma foto e uma linha sobre si.", href: "/settings", cta: "Editar perfil" },
    ...(host && Object.keys(host.links).length ? [{ done: followsHost, title: `Seguir ${hostFirst} nas redes`, detail: "O anfitrião da comunidade.", href: `/members/${host.handle}`, cta: "Ver perfil" }] : []),
    { done: d.hasPosted, title: "Apresentar-se à comunidade", detail: "Quem é e o que o trouxe.", href: "#publicar", cta: "Publicar" },
    { done: d.hasWatched, title: "Ver um vídeo exclusivo", detail: "Episódios e bastidores.", href: "/videos", cta: "Ver vídeos" },
    { done: d.mine.length > 0, title: "Entrar num desafio", detail: "Inscreva-se e submeta.", href: "/challenges", cta: "Ver desafios" },
  ];
  const setupDone = !steps || steps.every((s) => s.done);
  const viewer = { id: user.id, role: user.role };

  return (
    <div className="mx-auto grid max-w-[1040px] grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
      <div className="mx-auto w-full max-w-[640px] min-w-0 space-y-4 sm:space-y-5">
        <h1 className="sr-only">Início</h1>
        {sp.welcome && setupDone && <Notice tone="ok">Conta criada. Bem-vindo à comunidade No Competition.</Notice>}

        {(stories.length > 0 || user.role === "investor") && (
          <StoriesBar groups={stories} me={{ name: user.name, hue: user.avatarHue, fileId: user.avatarFileId }} canPost={user.role === "investor"} />
        )}

        {host && !followsHost && host.id !== user.id && Object.keys(host.links).length > 0 && <HostStrip host={host} />}

        <Composer
          name={user.name}
          hue={user.avatarHue}
          fileId={user.avatarFileId}
          canAnnounce={user.role === "investor"}
          challenges={challenges.filter((c) => challengePhase(c) !== "results").map((c) => ({ id: c.id, title: c.title }))}
        />

        {ranked.length > 0 ? (
          <Carousel
            title="Desafios"
            subtitle="Regras, critérios e prémios publicados antes de começar."
            action={
              <Link href="/challenges" className="text-[13px] font-semibold text-gold-strong hover:underline">
                Ver todos
              </Link>
            }
            itemClassName="w-[72%] sm:w-[calc(50%-8px)]"
          >
            {ranked.map((c) => (
              <ChallengeTile key={c.id} c={c} />
            ))}
          </Carousel>
        ) : (
          user.role === "investor" && (
            <Card>
              <EmptyState
                compact
                title="Ainda sem desafios"
                action={
                  <ButtonLink href="/admin/challenges/new" variant="accent" size="sm">
                    <Plus className="size-4" /> Criar desafio
                  </ButtonLink>
                }
              >
                Fica em rascunho até o publicar.
              </EmptyState>
            </Card>
          )
        )}

        <FilterChips
          label="Filtrar publicações"
          active={f.key}
          items={FILTERS.map((x) => ({ key: x.key, label: x.label, href: x.key === "all" ? "/dashboard" : `/dashboard?f=${x.key}` }))}
        />

        {feed.items.length === 0 ? (
          <>
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
          </>
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
        <CommunityCard members={stats.members} host={host} viewerId={user.id} followsHost={followsHost} />

        {steps && !setupDone && <FirstSteps compact title="Primeiros passos" steps={steps} />}

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
                <li key={r.userId} className={cx("flex items-center gap-3 rounded-xl px-3 py-2", r.userId === user.id && "bg-gold-soft")}>
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
