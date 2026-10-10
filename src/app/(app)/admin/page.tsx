import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CoverTile, glyphFor } from "@/components/cover-art";
import { PhaseBadge } from "@/components/domain";
import { FirstSteps } from "@/components/first-steps";
import { Badge, BarList, ButtonLink, Card, CardHeader, cx, EmptyState, PageHeader, Progress } from "@/components/ui";
import { fmtDay, timeAgo } from "@/lib/format";
import { OPPORTUNITY_TONE } from "@/lib/labels";
import { investorOverview } from "@/server/admin";
import { OPPORTUNITY_LABEL } from "@/server/review";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Administração" };

const toneClass = { gold: "bg-gold text-ink", warn: "bg-warn-soft text-warn", info: "bg-info-soft text-info", neutral: "bg-sunken text-muted" };

export default async function AdminPage() {
  const user = await requireUser(["investor"]);
  const o = await investorOverview(user);
  const kpis = [
    ["Desafios activos", o.kpis.active, "abertos, em breve ou em pausa"],
    ["Submissões recebidas", o.kpis.submissions, "em todos os desafios"],
    ["Por avaliar por si", o.kpis.toEvaluate, "em desafios encerrados"],
    ["Resultados por publicar", o.kpis.toPublish, "confirmados, ainda privados"],
    ["Oportunidades em curso", o.kpis.pipeline, "pipeline de investimento"],
  ] as const;
  const first = o.rows[0] ? `/admin/challenges/${o.rows[0].id}` : "/admin/challenges/new";
  const s = o.setup;
  const steps = [
    { done: s.hasPosts, title: "Publicar a mensagem de boas-vindas", detail: "Um anúncio oficial fica fixado no topo do Início de todos os membros.", href: "/dashboard#publicar", cta: "Escrever" },
    { done: s.hasVideos, title: "Publicar o primeiro vídeo", detail: "Crie uma colecção e cole o link do YouTube ou Vimeo. Escolha se é aberta a todos ou exclusiva.", href: "/admin/videos", cta: "Gerir vídeos" },
    { done: s.challengeCreated, title: "Criar o primeiro desafio", detail: "Tema, prazos, critérios de avaliação e prémios. Fica em rascunho até o publicar.", href: "/admin/challenges/new", cta: "Criar desafio" },
    { done: s.challengePublished, title: "Publicar o desafio", detail: "Os membros passam a vê-lo e a inscrever-se.", href: first, cta: "Abrir desafio" },
    { done: s.hasMembers, title: "Trazer os primeiros membros", detail: "Partilhe o endereço da plataforma: quem se regista entra como membro.", href: "/admin/people", cta: "Ver membros" },
    { done: s.hasEvaluators, title: "Nomear avaliadores", detail: "Em Membros e acessos, torne avaliador(a) quem vai pontuar as submissões.", href: "/admin/people", cta: "Membros e acessos" },
    { done: s.evaluatorsAssigned, title: "Atribuir avaliadores ao desafio", detail: "Cada avaliador(a) só vê as submissões dos desafios atribuídos.", href: `${first}?tab=evaluators`, cta: "Atribuir" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Olá, ${user.name.split(" ")[0]}`}
        title="Administração"
        description="Comunidade, vídeos, desafios e avaliações da No Competition: o que está a decorrer e o que depende de si."
        actions={
          <>
            <ButtonLink href="/admin/opportunities" variant="secondary">Pipeline</ButtonLink>
            <ButtonLink href="/admin/challenges/new" variant="accent"><Plus className="size-4" /> Novo desafio</ButtonLink>
          </>
        }
      />

      <FirstSteps title="Preparar a plataforma" steps={steps} />

      {s.challengeCreated && (
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([k, v, h], i) => (
          <div key={k} className={cx("rounded-2xl px-4 py-3 ring-1", i === 2 && v > 0 ? "bg-ink text-white ring-ink" : "bg-surface ring-line")}>
            <dt className={cx("text-[12px]", i === 2 && v > 0 ? "text-white/60" : "text-muted")}>{k}</dt>
            <dd className={cx("tabular font-display text-3xl font-semibold", i === 2 && v > 0 && "text-gold")}>{v}</dd>
            <dd className={cx("text-[12px]", i === 2 && v > 0 ? "text-white/60" : "text-muted")}>{h}</dd>
          </div>
        ))}
      </dl>
      )}

      {s.challengeCreated && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="min-w-0">
          <CardHeader title="Ciclo dos desafios" subtitle="Próxima acção para cada desafio" />
          {o.rows.length === 0 ? (
            <EmptyState title="Ainda não criou desafios" action={<ButtonLink href="/admin/challenges/new" variant="accent">Criar o primeiro desafio</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-line/70">
              {o.rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/challenges/${r.id}`} className="group flex flex-col gap-3 px-5 py-4 hover:bg-sunken/40 sm:flex-row sm:items-center">
                    <CoverTile hue={r.coverHue} glyph={glyphFor(r.title)} className="hidden size-11 rounded-xl sm:grid" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium group-hover:underline">{r.title}</span>
                        <PhaseBadge phase={r.phase} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                        <span>{r.participants} inscritos</span>
                        <span>{r.submissions} submissões</span>
                        <span>Prazo {fmtDay(r.submissionDeadline)}</span>
                      </div>
                      {r.status === "closed" && r.evaluationsExpected > 0 && (
                        <div className="mt-2 flex max-w-xs items-center gap-2">
                          <Progress value={(r.evaluationsDone / r.evaluationsExpected) * 100} tone="gold" className="flex-1" />
                          <span className="tabular text-[12px] text-muted">{r.evaluationsDone}/{r.evaluationsExpected}</span>
                        </div>
                      )}
                    </div>
                    <span className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-full px-3 text-[13px] font-medium sm:self-center", toneClass[r.next.tone])}>
                      {r.next.label} <ArrowRight className="size-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Submissões por desafio" subtitle="Desafios publicados; inscritos indicados por baixo" />
            <div className="p-5">
              <BarList
                label="Submissões por desafio"
                items={o.rows
                  .filter((r) => r.status !== "draft")
                  .map((r) => ({ key: r.id, label: r.title, value: r.submissions, hint: `${r.participants} inscritos`, href: `/admin/challenges/${r.id}?tab=submissions` }))}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Pipeline de investimento" action={<ButtonLink href="/admin/opportunities" variant="ghost" size="sm">Abrir</ButtonLink>} />
            {o.opportunities.length === 0 ? (
              <p className="p-5 text-sm text-muted">Sem oportunidades registadas.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {o.opportunities.map((x) => (
                  <li key={x.o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/projects/${x.projectSlug}`} className="min-w-0">
                      <div className="truncate text-sm font-medium hover:underline">{x.projectName}</div>
                      <div className="text-[12px] text-muted">{x.o.amount || "Montante a definir"}</div>
                    </Link>
                    <Badge tone={OPPORTUNITY_TONE[x.o.status]}>{OPPORTUNITY_LABEL[x.o.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Decisões recentes" />
            <ol className="divide-y divide-line/70">
              {o.history.map((h) => (
                <li key={h.id} className="px-5 py-3">
                  <p className="text-[13px] text-ink-2">{h.summary}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{h.actorName} · {timeAgo(h.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
      )}
    </div>
  );
}
