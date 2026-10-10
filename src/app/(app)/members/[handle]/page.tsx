import { Globe, KeyRound, MapPin, Pencil, Settings, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhaseBadge, PostRow, ProjectCard, RoleTag } from "@/components/domain";
import { Avatar, Badge, ButtonLink, Card, CardHeader, cx, EmptyState } from "@/components/ui";
import { ACCESS_LABEL, ROLE_LABEL } from "@/lib/labels";
import { listFeed } from "@/server/community";
import { challengePhase } from "@/lib/challenge-state";
import { fmtDate } from "@/lib/format";
import { DomainError } from "@/server/errors";
import { memberPoints } from "@/server/leaderboard";
import { canAccessTier } from "@/server/permissions";
import { getMember } from "@/server/members";
import { requireUser } from "@/server/session";

export async function generateMetadata(props: PageProps<"/members/[handle]">): Promise<Metadata> {
  try {
    return { title: (await getMember((await props.params).handle)).user.name };
  } catch {
    return {};
  }
}

export default async function MemberPage(props: PageProps<"/members/[handle]">) {
  const viewer = await requireUser();
  let d;
  try {
    d = await getMember((await props.params).handle);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const u = d.user;
  const [pts, activity] = await Promise.all([u.role === "member" ? memberPoints(u.id) : null, listFeed(viewer, { authorId: u.id, limit: 5 })]);
  const own = viewer.id === u.id;
  const fullAccess = canAccessTier(viewer, "full");
  const links = [
    [u.websiteUrl, "Website"],
    [u.linkedinUrl, "LinkedIn"],
    [u.githubUrl, "GitHub"],
  ].filter(([h]) => h) as [string, string][];

  return (
    <div className="space-y-6">
      <section aria-labelledby="member-name" className="overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/80">
        <div
          aria-hidden
          className="relative h-24 sm:h-32"
          style={{
            background:
              u.role === "investor"
                ? "radial-gradient(80% 140% at 85% 30%, rgb(212 242 74 / 0.22), transparent 60%), #101216"
                : `linear-gradient(120deg, hsl(${u.avatarHue} 38% 20%), hsl(${(u.avatarHue + 45) % 360} 42% 32%))`,
          }}
        >
          <div className="cover-grid absolute inset-0 opacity-60" />
        </div>
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-11 flex items-end justify-between gap-3 sm:-mt-14">
            <Avatar name={u.name} hue={u.avatarHue} fileId={u.avatarFileId} size={96} className="relative ring-4 ring-surface" />
            {own && (
              <ButtonLink href="/settings" variant="secondary" size="sm">
                <Pencil className="size-4" /> Editar perfil e foto
              </ButtonLink>
            )}
          </div>
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
            <div className="min-w-0">
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h1 id="member-name" className="font-display text-[26px] leading-tight font-semibold sm:text-[30px]">{u.name}</h1>
                <RoleTag role={u.role} />
              </div>
              {u.headline && <p className="mt-1 text-[15px] text-ink-2">{u.headline}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span>@{u.handle}</span>
                {u.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{u.location}</span>}
                {links.map(([h, l]) => (
                  <a key={l} href={h} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink"><Globe className="size-3.5" />{l}</a>
                ))}
              </div>
              {u.bio && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">{u.bio}</p>}
              {u.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {u.skills.map((s) => <span key={s} className="rounded-full bg-sunken px-2.5 py-1 text-[12px] text-ink-2">{s}</span>)}
                </div>
              )}
            </div>
            {pts?.overall && (
              <dl className="mt-6 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-5 lg:mt-4 lg:self-start lg:rounded-2xl lg:border-0 lg:bg-sunken lg:p-5">
                {[["Posição", `${pts.overall.rank}.º`], ["Pontos", pts.overall.total], ["Mérito", pts.overall.merit]].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12px] text-muted">{k}</dt>
                    <dd className="tabular font-display text-[22px] font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Actividade na comunidade</h2>
            <Card>
              {activity.items.length === 0 ? (
                <EmptyState title={own ? "Ainda não publicou" : "Sem publicações"} action={own && <ButtonLink href="/dashboard" variant="secondary" size="sm">Escrever a primeira publicação</ButtonLink>} />
              ) : (
                <div className="divide-y divide-line/70">{activity.items.map((f) => <PostRow key={f.post.id} item={f} />)}</div>
              )}
            </Card>
          </section>
          {(d.projects.length > 0 || (own && u.role === "member")) && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Projectos</h2>
                {own && <ButtonLink href="/projects/new" variant="ghost" size="sm">Novo projecto</ButtonLink>}
              </div>
              {d.projects.length === 0 ? (
                <Card><EmptyState title="Sem projectos">Um projecto é o que submete aos desafios.</EmptyState></Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {d.projects.map(({ p, title }) => <ProjectCard key={p.id} p={p} meta={title} />)}
                </div>
              )}
            </section>
          )}
        </div>
        <aside className="space-y-4">
          {own && (
            <Card>
              <CardHeader title="A sua conta" />
              <dl className="space-y-3 px-5 pb-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Acesso</dt>
                  <dd><Badge tone={fullAccess ? "volt" : "neutral"}><KeyRound className="size-3" /> {ACCESS_LABEL[fullAccess ? "full" : "free"]}</Badge></dd>
                </div>
                <p className="text-[12px] text-muted">
                  {viewer.role === "investor"
                    ? "Como administração, vê e gere todos os vídeos, incluindo as colecções exclusivas."
                    : fullAccess
                      ? "Vê todos os vídeos, incluindo as colecções exclusivas."
                      : "Vê os vídeos abertos a todos os membros. As colecções exclusivas são desbloqueadas pela equipa No Competition."}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Papel</dt>
                  <dd className="font-medium">{ROLE_LABEL[viewer.role]}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Email</dt>
                  <dd className="truncate font-medium">{viewer.email}</dd>
                </div>
                <ButtonLink href="/settings" variant="secondary" size="sm" className="w-full"><Settings className="size-4" /> Definições da conta</ButtonLink>
              </dl>
            </Card>
          )}
          {u.role === "member" && (d.achievements.length > 0 || own) && (
            <Card>
              <CardHeader title="Conquistas" />
              {d.achievements.length === 0 ? (
                <p className="p-5 text-sm text-muted">Os lugares conquistados em desafios com resultados publicados aparecem aqui.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {d.achievements.map((a) => (
                    <li key={a.challengeSlug + a.projectSlug} className="flex items-center gap-3 px-5 py-3">
                      <span className={cx("grid size-9 shrink-0 place-items-center rounded-full", a.rank === 1 ? "bg-volt" : "bg-sunken")}><Trophy className="size-4" /></span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{a.rank}.º lugar · {a.projectName}</div>
                        <Link href={`/challenges/${a.challengeSlug}`} className="block truncate text-[12px] text-muted hover:underline">{a.challengeTitle}{a.at && ` · ${fmtDate(a.at)}`}</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {u.role === "member" && (d.challenges.length > 0 || own) && (
            <Card>
              <CardHeader title="Participações" />
              {d.challenges.length === 0 ? (
                <p className="p-5 text-sm text-muted">
                  Ainda não participou em desafios. <Link href="/challenges" className="font-medium text-ink hover:underline">Ver desafios</Link>
                </p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {d.challenges.map(({ c }) => (
                    <li key={c.id} className="space-y-1.5 px-5 py-3">
                      <Link href={`/challenges/${c.slug}`} className="block text-sm leading-snug font-medium hover:underline">{c.title}</Link>
                      <PhaseBadge phase={challengePhase(c)} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
