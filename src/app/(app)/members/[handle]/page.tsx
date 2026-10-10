import { Globe, MapPin, Pencil, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhaseBadge, ProjectCard, RoleTag } from "@/components/domain";
import { Avatar, ButtonLink, Card, CardHeader, cx, EmptyState } from "@/components/ui";
import { challengePhase } from "@/lib/challenge-state";
import { fmtDate } from "@/lib/format";
import { DomainError } from "@/server/errors";
import { memberPoints } from "@/server/leaderboard";
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
  const pts = u.role === "member" ? await memberPoints(u.id) : null;
  const links = [
    [u.websiteUrl, "Website"],
    [u.linkedinUrl, "LinkedIn"],
    [u.githubUrl, "GitHub"],
  ].filter(([h]) => h) as [string, string][];

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={u.name} hue={u.avatarHue} fileId={u.avatarFileId} size={88} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[28px] leading-tight font-semibold">{u.name}</h1>
              <RoleTag role={u.role} />
            </div>
            <p className="mt-1 text-ink-2">{u.headline}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span>@{u.handle}</span>
              {u.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{u.location}</span>}
              {links.map(([h, l]) => (
                <a key={l} href={h} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink"><Globe className="size-3.5" />{l}</a>
              ))}
            </div>
            {u.bio && <p className="mt-4 max-w-2xl text-[15px] text-ink-2">{u.bio}</p>}
            {u.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {u.skills.map((s) => <span key={s} className="rounded-full bg-sunken px-2.5 py-1 text-[12px] text-ink-2">{s}</span>)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            {viewer.id === u.id && <ButtonLink href="/settings" variant="secondary" size="sm"><Pencil className="size-4" /> Editar perfil</ButtonLink>}
            {pts?.overall && (
              <div className="grid grid-cols-3 gap-4 rounded-2xl bg-sunken px-4 py-3 text-center">
                {[["Posição", `${pts.overall.rank}.º`], ["Pontos", pts.overall.total], ["Mérito", pts.overall.merit]].map(([k, v]) => (
                  <div key={k}><div className="tabular font-display text-xl font-semibold">{v}</div><div className="text-[11px] text-muted">{k}</div></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <h2 className="mb-3 text-[15px] font-semibold">Projectos</h2>
          {d.projects.length === 0 ? (
            <Card><EmptyState title="Sem projectos públicos" /></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {d.projects.map(({ p, title }) => <ProjectCard key={p.id} p={p} meta={title} />)}
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader title="Conquistas" />
            {d.achievements.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sem resultados publicados ainda.</p>
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
          <Card>
            <CardHeader title="Participações" />
            {d.challenges.length === 0 ? (
              <p className="p-5 text-sm text-muted">Ainda não participou em desafios.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.challenges.map(({ c }) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/challenges/${c.slug}`} className="min-w-0 truncate text-sm font-medium hover:underline">{c.title}</Link>
                    <PhaseBadge phase={challengePhase(c)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
