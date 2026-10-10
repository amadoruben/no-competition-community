import { Code2, ExternalLink, Globe, Pencil, PlayCircle, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonLine, StageBadge } from "@/components/domain";
import { Avatar, Badge, Breadcrumbs, ButtonLink, Card, CardHeader, EmptyState, Notice, ProjectLogo, Prose } from "@/components/ui";
import { fmtDate, timeAgo } from "@/lib/format";
import { OPPORTUNITY_TONE, SUBMISSION_STATUS_LABEL } from "@/lib/labels";
import { DomainError } from "@/server/errors";
import { getProjectBySlug } from "@/server/projects";
import { OPPORTUNITY_LABEL } from "@/server/review";
import { requireUser } from "@/server/session";
import { UpdateForm } from "./update-form";

async function load(slug: string, user: Awaited<ReturnType<typeof requireUser>>) {
  try {
    return await getProjectBySlug(slug, user);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
}

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const user = await requireUser();
  return { title: (await load((await props.params).slug, user)).project.name };
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const d = await load((await props.params).slug, user);
  const p = d.project;
  const links = [
    { href: p.websiteUrl, label: "Website", icon: Globe },
    { href: p.demoUrl, label: "Demonstração", icon: PlayCircle },
    { href: p.repoUrl, label: "Repositório", icon: Code2 },
  ].filter((l) => l.href);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Projectos", href: "/projects" }, { label: p.name }]} />
      {sp.created && <Notice tone="ok">Projecto criado. Complete a página e partilhe a primeira actualização.</Notice>}
      {sp.saved && <Notice tone="ok">Alterações guardadas.</Notice>}

      <Card className="overflow-hidden">
        <div className="h-24 sm:h-32" style={{ background: `linear-gradient(120deg, hsl(${p.logoHue} 60% 88%), hsl(${p.logoHue + 40} 55% 80%))` }} />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
              <ProjectLogo name={p.name} hue={p.logoHue} fileId={p.logoFileId} size={88} className="ring-4 ring-surface" />
              <div className="sm:pt-14">
                <h1 className="font-display text-[28px] leading-tight font-semibold sm:text-[34px]">{p.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>{p.category}</span>·<StageBadge stage={p.stage} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {links.map(({ href, label, icon: Icon }) => (
                <a key={label} href={href!} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium ring-1 ring-line-strong hover:bg-sunken">
                  <Icon className="size-4" /> {label} <ExternalLink className="size-3 text-muted" />
                </a>
              ))}
              {d.isMember && (
                <ButtonLink href={`/projects/${p.slug}/edit`} size="sm" className="h-9">
                  <Pencil className="size-4" /> Editar
                </ButtonLink>
              )}
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-[17px] text-ink-2">{p.tagline}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {(p.problem || p.solution) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <div className="text-[12px] font-semibold tracking-wide text-muted uppercase">Problema</div>
                <Prose text={p.problem || "—"} className="mt-2" />
              </Card>
              <Card className="p-5">
                <div className="text-[12px] font-semibold tracking-wide text-ok uppercase">Solução</div>
                <Prose text={p.solution || "—"} className="mt-2" />
              </Card>
            </div>
          )}
          {p.description && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 font-display text-lg font-semibold">Sobre o projecto</h2>
              <Prose text={p.description} />
            </Card>
          )}

          <Card id="updates">
            <CardHeader title="Actualizações de progresso" subtitle={`${d.updates.length} publicadas`} />
            {d.isMember && (
              <div className="border-b border-line/70 bg-sunken/40 p-5">
                <UpdateForm projectId={p.id} />
              </div>
            )}
            {d.updates.length === 0 ? (
              <EmptyState title="Sem actualizações ainda">{d.isMember ? "Partilhe o que construiu esta semana — é a melhor forma de ganhar tracção na comunidade." : "Esta equipa ainda não partilhou progresso."}</EmptyState>
            ) : (
              <ol className="relative space-y-0 p-5">
                {d.updates.map((u, i) => (
                  <li key={u.u.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < d.updates.length - 1 && <span className="absolute top-8 left-[15px] h-[calc(100%-24px)] w-px bg-line" aria-hidden />}
                    <Avatar name={u.authorName} hue={u.authorHue} size={32} />
                    <div className="min-w-0">
                      <div className="text-[13px] text-muted">
                        <span className="font-medium text-ink">{u.authorName}</span> · {timeAgo(u.u.createdAt)}
                      </div>
                      <h3 className="mt-1 font-semibold">{u.u.title}</h3>
                      <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{u.u.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Equipa" />
            <ul className="space-y-3 p-5">
              {d.team.map((t) => (
                <li key={t.id}>
                  <PersonLine name={t.name} handle={t.handle} hue={t.avatarHue} fileId={t.avatarFileId} sub={t.title || t.headline} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Desafios" />
            {d.submissions.length === 0 && d.enrolledChallenges.length === 0 ? (
              <p className="p-5 text-sm text-muted">Ainda não participou em desafios.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.submissions.map((s) => (
                  <li key={s.s.id} className="px-5 py-3">
                    <Link href={`/challenges/${s.challengeSlug}`} className="text-sm font-medium hover:underline">{s.challengeTitle}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      {s.rank ? (
                        <Badge tone={s.rank === 1 ? "volt" : "neutral"}><Trophy className="size-3" /> {s.rank}.º lugar</Badge>
                      ) : s.challengeStatus === "results_published" ? (
                        <Badge>Participou</Badge>
                      ) : (
                        <Badge tone="ok">{d.isMember || user.role === "investor" ? SUBMISSION_STATUS_LABEL[s.s.status] : "Submetido"}</Badge>
                      )}
                      <span>{fmtDate(s.s.submittedAt)}</span>
                    </div>
                  </li>
                ))}
                {d.enrolledChallenges
                  .filter((e) => !d.submissions.some((s) => s.challengeSlug === e.slug))
                  .map((e) => (
                    <li key={e.slug} className="px-5 py-3">
                      <Link href={`/challenges/${e.slug}`} className="text-sm font-medium hover:underline">{e.title}</Link>
                      <div className="mt-1"><Badge tone="info">Inscrito</Badge></div>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
          {user.role === "investor" && (
            <Card>
              <CardHeader title="Pipeline de investimento" subtitle="Visível apenas para si" action={<ButtonLink href={`/admin/opportunities?project=${p.id}`} variant="ghost" size="sm">Gerir</ButtonLink>} />
              {d.opportunities.length === 0 ? (
                <p className="p-5 text-sm text-muted">Sem oportunidades registadas.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {d.opportunities.map((o) => (
                    <li key={o.id} className="px-5 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={OPPORTUNITY_TONE[o.status]}>{OPPORTUNITY_LABEL[o.status]}</Badge>
                        <span className="font-medium">{o.amount}</span>
                      </div>
                      {o.note && <p className="mt-1.5 text-[13px] text-ink-2">{o.note}</p>}
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
