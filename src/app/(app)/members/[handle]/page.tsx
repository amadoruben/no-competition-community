import { BadgeCheck, FolderKanban, Globe, Grid3x3, Heart, HelpCircle, Images, KeyRound, MapPin, Megaphone, MessageCircle, Play, Plus, Settings, TrendingUp, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Art, prizeArt } from "@/components/art";
import { PhaseBadge, ProjectCard } from "@/components/domain";
import { ProfileAvatar, ShareProfile } from "@/components/profile/profile-client";
import { FollowButton } from "@/components/social/follow-button";
import { PlatformTile } from "@/components/social/platform-icon";
import { storyGroupOf } from "@/components/stories/server";
import { ButtonLink, Card, cx, EmptyState, fileUrl, Pagination } from "@/components/ui";
import { POST_KINDS } from "@/db/schema";
import { challengePhase } from "@/lib/challenge-state";
import { fmtDate, plural } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { cleanLinks, profileHandle, SOCIAL_PLATFORM_LABEL, SOCIAL_PLATFORMS } from "@/lib/social";
import { videoSource } from "@/lib/video";
import { listFeed, type FeedItem } from "@/server/community";
import { DomainError } from "@/server/errors";
import { profileStats } from "@/server/follows";
import { memberPoints } from "@/server/leaderboard";
import { getMember } from "@/server/members";
import { canAccessTier } from "@/server/permissions";
import { requireUser } from "@/server/session";

export async function generateMetadata(props: PageProps<"/members/[handle]">): Promise<Metadata> {
  try {
    const viewer = await requireUser();
    return { title: (await getMember(viewer, (await props.params).handle)).user.name };
  } catch {
    return {};
  }
}

const TABS = [
  { key: "posts", label: "Publicações", icon: Grid3x3 },
  { key: "projects", label: "Projectos", icon: FolderKanban },
  { key: "challenges", label: "Desafios", icon: Trophy },
] as const;

/**
 * A member's profile, laid out like the social apps people already know: photo
 * (with the story ring when there are stories), real numbers, who they are,
 * their networks, follow, then their posts as a grid, their projects and
 * their challenges.
 */
export default async function MemberPage(props: PageProps<"/members/[handle]">) {
  const viewer = await requireUser();
  const sp = await props.searchParams;
  let d;
  try {
    d = await getMember(viewer, (await props.params).handle);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const u = d.user;
  const own = viewer.id === u.id;
  // The team and evaluators have no projects or challenge entries: their profile is their posts.
  const tabs = u.role === "member" ? TABS : TABS.filter((t) => t.key === "posts");
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "posts";
  const page = Number(sp.page) || 1;
  const [stats, pts, grid, stories] = await Promise.all([
    profileStats(viewer, u.id),
    u.role === "member" ? memberPoints(u.id) : null,
    tab === "posts" ? listFeed(viewer, { authorId: u.id, kinds: POST_KINDS, limit: 24, page }) : null,
    storyGroupOf(viewer, u.id),
  ]);
  const links = cleanLinks(u.socialLinks);
  const networks = SOCIAL_PLATFORMS.filter((p) => links[p]);
  const official = u.role === "investor";
  const web = [
    [u.websiteUrl, "Website"],
    [u.linkedinUrl, "LinkedIn"],
    [u.githubUrl, "GitHub"],
  ].filter(([h]) => h) as [string, string][];
  const base = `/members/${u.handle}`;

  // Community numbers, not audience numbers: what this person contributed.
  const statItems = [
    { n: stats.posts, label: stats.posts === 1 ? "publicação" : "publicações", href: `${base}` },
    ...(u.role === "member" ? [{ n: d.projects.length, label: d.projects.length === 1 ? "projecto" : "projectos", href: `${base}?tab=projects` }] : []),
    ...(pts?.overall ? [{ n: pts.overall.total, label: "pontos", href: "/leaderboard" }] : []),
  ];

  return (
    <div className="mx-auto max-w-[935px]">
      <section aria-labelledby="member-name" className="px-1 pt-1 md:px-6 md:pt-6">
        <div className="flex items-center gap-6 md:items-start md:gap-14">
          <ProfileAvatar name={u.name} hue={u.avatarHue} fileId={u.avatarFileId} group={stories} className="shrink-0 md:ml-6" />
          <div className="min-w-0 flex-1">
            <div className="hidden flex-wrap items-center gap-3 md:flex">
              <NameLine name={u.name} official={official} role={u.role} />
              {actions()}
            </div>
            <ul className="grid grid-cols-3 gap-2 md:mt-5 md:flex md:gap-10">
              {statItems.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="block text-left leading-tight hover:opacity-80">
                    <span className="tabular block font-display text-[19px] font-bold md:inline md:text-[17px]">{s.n}</span>{" "}
                    <span className="text-[13.5px] text-ink-2 md:text-[15px]">{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5 hidden md:block">
              {about()}
            </div>
          </div>
        </div>
        <div className="mt-4 md:hidden">
          <NameLine name={u.name} official={official} role={u.role} />
          {about()}
          <div className="mt-4">
            {actions()}
          </div>
        </div>
      </section>

      <nav aria-label="Secções do perfil" className={cx("mt-8 grid border-t border-line md:mt-12", tabs.length === 3 ? "grid-cols-3" : "grid-cols-1")}>
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              href={key === "posts" ? base : `${base}?tab=${key}`}
              aria-current={active ? "page" : undefined}
              className={cx(
                "-mt-px flex h-12 items-center justify-center gap-2 border-t-2 text-[12.5px] font-semibold tracking-wide uppercase transition-colors",
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              <span className="hidden min-[400px]:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {tab === "posts" && grid && (
        <section aria-label="Publicações" className="-mx-4 sm:mx-0">
          {grid.items.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <Art name="speech" size={72} className="mx-auto" />
              <h2 className="mt-4 font-display text-[19px] font-bold">{own ? "Ainda não publicou" : "Ainda sem publicações"}</h2>
              <p className="mt-1 text-[14px] text-muted">{own ? "A sua primeira publicação aparece aqui." : `Quando ${u.name.split(" ")[0]} publicar, aparece aqui.`}</p>
              {own && (
                <ButtonLink href="/dashboard#publicar" variant="accent" className="mt-5 font-semibold">
                  <Plus className="size-4" /> Escrever a primeira publicação
                </ButtonLink>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-0.5 sm:gap-1">
              {grid.items.map((item) => (
                <li key={item.post.id}>
                  <GridTile item={item} />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={grid.page} pages={grid.pages} href={(n) => `${base}?page=${n}`} />
        </section>
      )}

      {tab === "projects" && (
        <section aria-label="Projectos" className="pt-6">
          {own && u.role === "member" && (
            <div className="mb-4 flex justify-end">
              <ButtonLink href="/projects/new" variant="secondary" size="sm">
                <Plus className="size-4" /> Novo projecto
              </ButtonLink>
            </div>
          )}
          {d.projects.length === 0 ? (
            <Card>
              <EmptyState icon={<FolderKanban />} title="Sem projectos">
                {own ? "Um projecto é o que submete aos desafios. Crie o primeiro quando quiser." : "Ainda não há projectos neste perfil."}
              </EmptyState>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {d.projects.map(({ p, title }) => (
                <ProjectCard key={p.id} p={p} meta={title} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "challenges" && (
        <section aria-label="Desafios" className="grid gap-6 pt-6 lg:grid-cols-2">
          <Card>
            <h2 className="flex items-center gap-2 px-5 pt-5 text-[15px] font-semibold">Conquistas</h2>
            {d.achievements.length === 0 ? (
              <div className="flex items-center gap-4 p-5">
                <Art name="trophy" size={56} />
                <p className="text-[14px] text-muted">Os lugares conquistados em desafios aparecem aqui quando os resultados são publicados.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line/70 p-2">
                {d.achievements.map((a) => (
                  <li key={a.challengeSlug + a.projectSlug} className="flex items-center gap-3 px-3 py-3">
                    <Art name={prizeArt(a.rank, "prize")} size={44} alt={`${a.rank}.º lugar`} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold">
                        {a.rank}.º lugar · {a.projectName}
                      </div>
                      <Link href={`/challenges/${a.challengeSlug}`} className="block truncate text-[12.5px] text-muted hover:underline">
                        {a.challengeTitle}
                        {a.at && ` · ${fmtDate(a.at)}`}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="px-5 pt-5 text-[15px] font-semibold">Participações</h2>
            {d.challenges.length === 0 ? (
              <p className="p-5 text-[14px] text-muted">
                {own ? (
                  <>
                    Ainda não participou em desafios.{" "}
                    <Link href="/challenges" className="font-medium text-ink hover:underline">
                      Ver desafios
                    </Link>
                  </>
                ) : (
                  "Sem participações em desafios publicados."
                )}
              </p>
            ) : (
              <ul className="divide-y divide-line/70 p-2">
                {d.challenges.map(({ c }) => (
                  <li key={c.id} className="space-y-1.5 px-3 py-3">
                    <Link href={`/challenges/${c.slug}`} className="block text-[14px] leading-snug font-medium hover:underline">
                      {c.title}
                    </Link>
                    <PhaseBadge phase={challengePhase(c)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
    </div>
  );

  function actions() {
    if (own)
      return (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/settings" className="h-10 flex-1 rounded-full bg-sunken px-4 text-[14px] font-semibold text-ink hover:bg-line md:flex-none" variant="ghost">
            Editar perfil
          </ButtonLink>
          <ShareProfile path={base} name={u.name} className="flex-1 md:flex-none" />
          <Link href="/settings" aria-label="Definições da conta" title="Definições" className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-ink transition-colors hover:bg-line">
            <Settings className="size-[18px]" />
          </Link>
        </div>
      );
    return (
      <div className="flex flex-wrap gap-2">
        {networks.length > 0 && (
          <div className="flex-1 md:flex-none">
            <FollowButton userId={u.id} name={u.name} following={stats.viewerFollows} links={links} block />
          </div>
        )}
        <ShareProfile path={base} name={u.name} className="flex-1 md:flex-none" />
      </div>
    );
  }

  function about() {
    const fullAccess = canAccessTier(viewer, "full");
    return (
      <div className="space-y-2 text-[14.5px] leading-relaxed">
        {u.headline && <p className="font-medium text-ink">{u.headline}</p>}
        {u.bio && <p className="whitespace-pre-line text-ink-2">{u.bio}</p>}
        {(u.location || web.length > 0) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted">
            {u.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {u.location}
              </span>
            )}
            {web.map(([h, l]) => (
              <a key={l} href={h} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:underline">
                <Globe className="size-3.5" />
                {l}
              </a>
            ))}
          </p>
        )}
        {networks.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1" aria-label="Redes sociais">
            {networks.map((p) => (
              <li key={p}>
                <a
                  href={links[p]}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${SOCIAL_PLATFORM_LABEL[p]} · ${profileHandle(p, links[p]!)}`}
                  className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 text-[13px] font-medium ring-1 ring-line transition hover:ring-ink/25"
                >
                  <PlatformTile platform={p} size={26} className="!rounded-full" />
                  {SOCIAL_PLATFORM_LABEL[p].replace(" (Twitter)", "")}
                  <span className="sr-only">: {profileHandle(p, links[p]!)} (abre noutro separador)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {pts?.overall && (
          <Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-full bg-gold-soft px-3 py-1 text-[13px] font-medium text-gold-strong ring-1 ring-gold-line hover:bg-gold-soft/70">
            <Trophy className="size-3.5" /> {pts.overall.rank}.º na classificação · {plural(pts.overall.total, "ponto", "pontos")}
          </Link>
        )}
        {own && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <KeyRound className="size-3.5" />
            {viewer.role === "investor"
              ? "Administração: vê e gere todos os vídeos."
              : fullAccess
                ? "Acesso completo: vê todas as colecções de vídeos."
                : "Acesso livre: as colecções exclusivas são desbloqueadas pela equipa No Competition."}
          </p>
        )}
      </div>
    );
  }
}

function NameLine({ name, official, role }: { name: string; official: boolean; role: "member" | "evaluator" | "investor" }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <h1 id="member-name" className="font-display text-[20px] leading-tight font-bold md:text-[22px]">
        {name}
      </h1>
      {official && (
        <span role="img" aria-label="Conta oficial No Competition" title="Conta oficial No Competition">
          <BadgeCheck aria-hidden className="size-5 fill-ink text-gold" />
        </span>
      )}
      {role === "evaluator" && <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11.5px] font-medium text-violet">{ROLE_LABEL.evaluator}</span>}
      {official && <span className="text-[13px] text-muted">Equipa No Competition</span>}
    </div>
  );
}

/** The type of a text post, as a small mark in the corner of its tile. */
function KindMark({ kind }: { kind: string }) {
  const [Icon, label, tone] =
    kind === "announcement"
      ? [Megaphone, "Anúncio", "text-gold-strong"]
      : kind === "question"
        ? [HelpCircle, "Pergunta", "text-info"]
        : kind === "progress"
          ? [TrendingUp, "Progresso", "text-ok"]
          : [MessageCircle, "Conversa", "text-ink-2"];
  return (
    <span className={cx("inline-flex items-center gap-1 text-[10px] font-semibold sm:text-[12px]", tone)}>
      <Icon className="size-3 sm:size-3.5" /> <span className="hidden min-[420px]:inline">{label}</span>
    </span>
  );
}

/** One post in the profile grid: its first photo, the video thumbnail, or its words. */
function GridTile({ item }: { item: FeedItem }) {
  const p = item.post;
  const photo = item.media[0];
  const video = videoSource(p.videoUrl);
  const label = p.title || p.body.slice(0, 80) || "Publicação";
  return (
    <Link href={`/community/${p.id}`} aria-label={label} className="group relative block aspect-[4/5] overflow-hidden bg-sunken">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- auth-gated /files URL
        <img src={fileUrl(photo.fileId)} alt="" loading="lazy" className="size-full object-cover" />
      ) : video?.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- provider thumbnail
        <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className={cx("flex size-full flex-col p-2.5 sm:p-5", p.kind === "announcement" ? "bg-gold-soft" : "bg-mist")}>
          <KindMark kind={p.kind} />
          <span className="mt-auto line-clamp-5 font-display text-[11.5px] leading-snug font-bold text-ink sm:text-[17px] md:text-[19px]">{p.title || p.body}</span>
          {p.title && p.body && <span className="mt-1 line-clamp-2 hidden text-[13px] leading-snug text-ink-2 sm:block">{p.body}</span>}
        </span>
      )}
      {(item.media.length > 1 || video) && (
        <span className="absolute top-2 right-2 text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]">
          {video ? <Play className="size-4 fill-current" /> : <Images className="size-4" />}
        </span>
      )}
      <span className="absolute inset-0 hidden items-center justify-center gap-5 bg-black/35 text-[15px] font-semibold text-white group-hover:flex">
        <span className="inline-flex items-center gap-1.5">
          <Heart className="size-5 fill-current" /> {item.reactionCount}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="size-5 fill-current" /> {item.commentCount}
        </span>
      </span>
    </Link>
  );
}
