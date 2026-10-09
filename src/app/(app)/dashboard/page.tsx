import { ArrowRight, CircleAlert, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChallengeCard, PersonLine, PhaseBadge, phaseTimeline, PostRow, RankMedal, StageBadge } from "@/components/domain";
import { Badge, ButtonLink, Card, CardHeader, cx, EmptyState, Notice, ProjectLogo } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { memberDashboard } from "@/server/dashboard";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Início" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
}

export default async function Dashboard(props: PageProps<"/dashboard">) {
  const user = await requireUser(["member"]);
  const sp = await props.searchParams;
  const d = memberDashboard(user);
  const overall = d.points.overall;

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <Notice tone="ok">
          Conta criada. Comece por criar o seu projecto e inscrever-se num desafio aberto.
        </Notice>
      )}

      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">{greeting()},</p>
          <h1 className="font-display text-[32px] leading-tight font-semibold">{user.name.split(" ")[0]}</h1>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[560px]">
          {[
            ["Posição geral", overall ? `${overall.rank}.º` : "—", overall ? `de ${d.points.totalMembers} membros` : "Ainda sem pontos"],
            ["Pontos totais", overall?.total ?? 0, overall ? `${overall.merit} de mérito` : "Participe para pontuar"],
            ["Esta semana", d.points.weekly?.total ?? 0, d.points.weekly ? `${d.points.weekly.rank}.º na semana` : "Sem actividade"],
            ["Desafios", d.mine.length, `${d.mine.filter((c) => c.viewerSubmitted).length} com submissão`],
          ].map(([k, v, h]) => (
            <div key={k as string} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="tabular font-display text-2xl font-semibold">{v}</dd>
              <dd className="truncate text-[12px] text-muted">{h}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Precisa da sua atenção" subtitle="Próximos passos nos seus desafios e projectos" />
            {d.todos.length === 0 ? (
              <EmptyState icon={<Sparkles className="size-5" />} title="Está tudo em dia">
                Explore um desafio aberto ou partilhe progresso com a comunidade.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.todos.map((t) => (
                  <li key={t.key}>
                    <Link href={t.href} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-sunken/50">
                      <span className={cx("grid size-8 shrink-0 place-items-center rounded-full", t.urgent ? "bg-warn-soft text-warn" : "bg-sunken text-muted")}>
                        <CircleAlert className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className={cx("block text-[13px]", t.urgent ? "text-warn" : "text-muted")}>{t.detail}</span>
                      </span>
                      <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Os meus desafios" action={<ButtonLink href="/challenges" variant="ghost" size="sm">Ver todos</ButtonLink>} />
            {d.mine.length === 0 ? (
              <EmptyState title="Ainda não participa em nenhum desafio" action={<ButtonLink href="/challenges" variant="accent">Descobrir desafios</ButtonLink>}>
                Inscreva-se para começar a construir e a pontuar.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.mine.map((c) => (
                  <li key={c.id}>
                    <Link href={`/challenges/${c.slug}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-sunken/50 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{c.title}</div>
                        <div className="text-[13px] text-muted">{phaseTimeline(c, c.phase)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PhaseBadge phase={c.phase} />
                        {c.viewerSubmitted ? <Badge tone="ok">Submetido</Badge> : <Badge tone="warn">Por submeter</Badge>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Os meus projectos</h2>
              <ButtonLink href="/projects/new" variant="secondary" size="sm">
                <Plus className="size-4" /> Novo projecto
              </ButtonLink>
            </div>
            {d.projects.length === 0 ? (
              <Card>
                <EmptyState title="Sem projectos" action={<ButtonLink href="/projects/new" variant="accent">Criar projecto</ButtonLink>}>
                  O projecto é a sua montra: problema, solução, equipa e progresso.
                </EmptyState>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.slug}`} className="group">
                    <Card className="flex items-center gap-3 p-4 transition-shadow group-hover:shadow-[var(--shadow-pop)]">
                      <ProjectLogo name={p.name} hue={p.logoHue} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold group-hover:underline">{p.name}</div>
                        <div className="text-[12px] text-muted">{p.lastUpdate ? `Actualizado ${timeAgo(p.lastUpdate)}` : "Sem actualizações"}</div>
                      </div>
                      <StageBadge stage={p.stage} />
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {d.discover.length > 0 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">Desafios para si</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {d.discover.slice(0, 2).map((c) => (
                  <ChallengeCard key={c.id} c={c} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Classificação geral" action={<ButtonLink href="/leaderboard" variant="ghost" size="sm">Ver</ButtonLink>} />
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

          <Card>
            <CardHeader title="Pontos recentes" />
            {d.points.recent.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Inscreva-se num desafio para ganhar os primeiros pontos.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.points.recent.slice(0, 5).map((e, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className={cx("tabular w-12 font-semibold", e.kind === "merit" ? "text-ok" : "text-ink")}>+{e.points}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-2">{e.reason}</span>
                    <span className="text-[12px] whitespace-nowrap text-faint">{timeAgo(e.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Na comunidade" action={<ButtonLink href="/community" variant="ghost" size="sm">Abrir</ButtonLink>} />
            <div className="divide-y divide-line/70">
              {d.feed.map((f) => (
                <PostRow key={f.post.id} item={f} />
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
