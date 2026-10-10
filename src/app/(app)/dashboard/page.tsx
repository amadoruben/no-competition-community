import { Bookmark, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CommunityCard, type Host } from "@/components/community-card";
import { PersonLine, RankMedal } from "@/components/domain";
import { Composer } from "@/components/feed/composer";
import { PostRow } from "@/components/feed/post-row";
import { FirstSteps } from "@/components/first-steps";
import { Card, CardHeader, cx, EmptyState, FilterChips, Notice, Pagination } from "@/components/ui";
import type { AnyPostKind } from "@/db/schema";
import { challengePhase } from "@/lib/challenge-state";
import { cleanLinks } from "@/lib/social";
import { listChallenges } from "@/server/challenges";
import { listFeed } from "@/server/community";
import { communityStats, memberDashboard } from "@/server/dashboard";
import { followeeIds } from "@/server/follows";
import { communityHost } from "@/server/members";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Início" };

const FILTERS: { key: string; label: string; kind?: AnyPostKind; saved?: true }[] = [
  { key: "all", label: "Todos" },
  { key: "announcement", label: "📣 Anúncios", kind: "announcement" },
  { key: "discussion", label: "💬 Geral", kind: "discussion" },
  { key: "question", label: "❓ Perguntas", kind: "question" },
  { key: "progress", label: "🚀 Progresso", kind: "progress" },
  { key: "social", label: "🔗 Redes", kind: "social" },
  { key: "saved", label: "Guardados", saved: true },
];

/**
 * Comunidade (Início), Skool-style: "Escreva algo", the categories, then the
 * posts as compact rows (title, two lines, thumbnail, reactions and who
 * commented). Wide screens add the community card, first steps and the
 * ranking on the side. Challenges and videos have their own tabs.
 */
export default async function Home(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  const page = Number(sp.page) || 1;
  const [feed, challengeList, stats, d, hostRow, followed] = await Promise.all([
    listFeed(user, { kind: f.kind, saved: f.saved, page }),
    listChallenges(user),
    communityStats(user),
    user.role === "member" ? memberDashboard(user) : null,
    communityHost(user),
    followeeIds(user.id),
  ]);
  const challenges = challengeList.filter((c) => c.status !== "draft");
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <div className="mx-auto w-full max-w-[680px] min-w-0 space-y-3.5 lg:max-w-none">
        <h1 className="sr-only">Comunidade</h1>
        {sp.welcome && setupDone && <Notice tone="ok">Conta criada. Bem-vindo à comunidade No Competition.</Notice>}

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
                ? "Toque no marcador de uma publicação para a guardar aqui."
                : f.kind
                  ? "Experimente outra categoria ou publique nesta."
                  : user.role === "investor"
                    ? "Publique um anúncio oficial de boas-vindas: fica fixado no topo da comunidade."
                    : "Apresente-se: diga quem é e o que está a construir."}
            </EmptyState>
          </Card>
        ) : (
          <div className="space-y-3">
            {feed.items.map((item) => (
              <PostRow key={item.post.id} item={item} viewer={viewer} />
            ))}
          </div>
        )}
        <Pagination page={feed.page} pages={feed.pages} href={(n) => `/dashboard?${new URLSearchParams({ ...(f.key !== "all" ? { f: f.key } : {}), page: String(n) })}`} />
      </div>

      <aside className="hidden space-y-4 lg:sticky lg:top-32 lg:block lg:self-start" aria-label="Na comunidade">
        <CommunityCard members={stats.members} host={host} viewerId={user.id} followsHost={followsHost} />
        {steps && !setupDone && <FirstSteps compact title="Primeiros passos" steps={steps} />}
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
      </aside>
    </div>
  );
}
