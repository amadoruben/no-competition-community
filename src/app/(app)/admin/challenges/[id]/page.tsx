import { ClipboardCheck, Eye, Pencil, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhaseBadge, RankMedal, RoleTag, ScorePill } from "@/components/domain";
import { Avatar, Badge, BarList, Breadcrumbs, ButtonLink, SortHeader, Card, CardHeader, cx, EmptyState, Notice, ProjectLogo, Tabs } from "@/components/ui";
import { challengePhase, STATUS_LABEL } from "@/lib/challenge-state";
import { fmtDate, fmtDateTime, fmtScore } from "@/lib/format";
import { STAGE_LABEL, SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@/lib/labels";
import { getChallengeBySlug, type ChallengeDetail } from "@/server/challenges";
import type { HistoryEntry } from "@/server/log";
import { DomainError } from "@/server/errors";
import { evaluatorsDirectory } from "@/server/members";
import { reviewBoard, type ReviewBoard } from "@/server/review";
import { requireUser } from "@/server/session";
import { EvaluatorToggle, PublishResultsButton, StatusControls, SubmissionStatusSelect } from "./controls";
import { ResultsForm } from "./results-form";

export const metadata: Metadata = { title: "Gerir desafio" };

export default async function ManageChallenge(props: PageProps<"/admin/challenges/[id]">) {
  const user = await requireUser(["investor"]);
  const { id } = await props.params;
  const sp = await props.searchParams;
  let b;
  try {
    b = await reviewBoard(user, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const c = b.challenge;
  const phase = challengePhase(c);
  const detail = await getChallengeBySlug(c.slug, user);
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";
  const published = c.status === "results_published";
  const evaluatorTotal = b.evaluators.length;
  const evalDone = b.rows.reduce((s, r) => s + r.evaluations.length, 0);
  const evalExpected = b.rows.length * evaluatorTotal;
  const sortKey = typeof sp.sort === "string" && ["score", "date", "name", "evals"].includes(sp.sort) ? sp.sort : "score";
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const sortedRows = [...b.rows].sort((x, y) => {
    const v =
      sortKey === "name" ? x.project.name.localeCompare(y.project.name, "pt") :
      sortKey === "date" ? +x.submission.submittedAt - +y.submission.submittedAt :
      sortKey === "evals" ? x.evaluationCount - y.evaluationCount :
      (x.score ?? -1) - (y.score ?? -1);
    return sortDir === "asc" ? v : -v;
  });
  const sortHref = (k: string, d: "asc" | "desc") => `/admin/challenges/${id}?tab=submissions&sort=${k}&dir=${d}`;
  const compareIds = typeof sp.ids === "string" ? sp.ids.split(",") : b.rows.filter((r) => r.rank !== null).slice(0, 4).map((r) => r.submission.id);

  const tabs = [
    { key: "overview", label: "Resumo" },
    { key: "submissions", label: "Submissões", count: b.rows.length },
    { key: "compare", label: "Comparar" },
    { key: "evaluators", label: "Avaliadores", count: evaluatorTotal },
    { key: "results", label: "Resultados" },
    { key: "history", label: "Histórico", count: b.history.length },
  ].map((t) => ({ ...t, href: `/admin/challenges/${id}${t.key === "overview" ? "" : `?tab=${t.key}`}` }));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Painel", href: "/admin" }, { label: c.title }]} />
      {sp.created && <Notice tone="ok">Rascunho criado. Reveja os detalhes e publique quando estiver pronto.</Notice>}
      {sp.saved && <Notice tone="ok">Alterações guardadas.</Notice>}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={phase} />
              <span className="text-[13px] text-muted">Estado: {STATUS_LABEL[c.status]} · {c.category}</span>
            </div>
            <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold">{c.title}</h1>
            <p className="mt-1 text-ink-2">{c.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {c.status !== "draft" && <ButtonLink href={`/challenges/${c.slug}`} variant="ghost"><Eye className="size-4" /> Ver como membro</ButtonLink>}
            {!published && <ButtonLink href={`/admin/challenges/${id}/edit`} variant="secondary"><Pencil className="size-4" /> Editar</ButtonLink>}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-5">
          {[
            ["Inscritos", detail.participantCount],
            ["Submissões", b.rows.length],
            ["Avaliações", evalExpected ? `${evalDone}/${evalExpected}` : "—"],
            ["Prazo", fmtDate(c.submissionDeadline)],
            ["Resultados", published ? fmtDate(c.resultsPublishedAt!) : `Prev. ${fmtDate(c.resultsDate)}`],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="tabular font-display text-xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {!published && (
          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">
              {c.status === "draft" && "Rascunho: apenas visível para si."}
              {c.status === "published" && phase === "open" && "A receber inscrições e submissões."}
              {c.status === "published" && phase === "upcoming" && "Publicado; abre para submissões na data de abertura."}
              {c.status === "published" && phase === "reviewing" && "O prazo terminou. Encerre as submissões para concluir a avaliação."}
              {c.status === "paused" && "Em pausa: os membros não podem submeter."}
              {c.status === "closed" && "Submissões encerradas. Avalie, confirme e publique os resultados."}
            </p>
            <StatusControls id={id} status={c.status} />
          </div>
        )}
      </Card>

      <Tabs active={tab} items={tabs} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader title="Classificação provisória" subtitle={published ? "Resultados publicados" : "Visível apenas para si e para os avaliadores"} action={<ButtonLink href={`/admin/challenges/${id}?tab=submissions`} variant="ghost" size="sm">Todas</ButtonLink>} />
            {b.rows.length === 0 ? (
              <EmptyState title="Ainda sem submissões">{phase === "open" ? `${detail.participantCount} membros inscritos estão a preparar projectos.` : "As submissões aparecem aqui."}</EmptyState>
            ) : (
              <ol className="divide-y divide-line/70">
                {b.rows.slice(0, 6).map((r) => (
                  <li key={r.submission.id}>
                    <Link href={`/evaluate/${r.submission.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken/40">
                      {r.rank ? <RankMedal rank={r.rank} /> : <span className="w-8 text-center text-muted">—</span>}
                      <ProjectLogo name={r.project.name} hue={r.project.logoHue} fileId={r.project.logoFileId} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.project.name}</div>
                        <div className="text-[12px] text-muted">{r.evaluationCount}/{evaluatorTotal} avaliações{!r.viewerEvaluated && !published && " · falta a sua"}</div>
                      </div>
                      <ScorePill score={r.score} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Funil do desafio" subtitle="Da inscrição à classificação" />
              <div className="p-5">
                <BarList
                  label="Funil do desafio"
                  max={Math.max(1, detail.participantCount)}
                  items={[
                    { key: "enrolled", label: "Inscritos", value: detail.participantCount },
                    { key: "submitted", label: "Submissões", value: b.rows.length },
                    { key: "scored", label: "Com avaliação completa", value: b.rows.filter((r) => r.evaluationCount > 0).length },
                    { key: "ranked", label: "Classificados", value: b.confirmed.length },
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Critérios" />
              <ul className="divide-y divide-line/70">
                {b.criteria.map((cr) => (
                  <li key={cr.id} className="flex justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>{cr.name}</span>
                    <span className="tabular font-mono text-muted">peso {cr.weight}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Últimas decisões" action={<ButtonLink href={`/admin/challenges/${id}?tab=history`} variant="ghost" size="sm">Histórico</ButtonLink>} />
              <HistoryList items={b.history.slice(0, 4)} />
            </Card>
          </div>
        </div>
      )}

      {tab === "submissions" && (
        <Card className="overflow-hidden">
          {b.rows.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="size-5" />} title="Ainda sem submissões" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-sunken/50 text-left text-[12px] text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">#</th>
                    <SortHeader label="Projecto" sortKey="name" current={sortKey} dir={sortDir} href={sortHref} />
                    <SortHeader label="Submetido" sortKey="date" current={sortKey} dir={sortDir} href={sortHref} />
                    <SortHeader label="Avaliações" sortKey="evals" current={sortKey} dir={sortDir} href={sortHref} />
                    <SortHeader label="Nota" sortKey="score" current={sortKey} dir={sortDir} href={sortHref} align="right" />
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {sortedRows.map((r) => (
                    <tr key={r.submission.id} className="hover:bg-sunken/30">
                      <td className="px-4 py-3">{r.rank ? <RankMedal rank={r.rank} /> : <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <ProjectLogo name={r.project.name} hue={r.project.logoHue} fileId={r.project.logoFileId} size={32} />
                          <div className="min-w-0">
                            <Link href={`/evaluate/${r.submission.id}`} className="font-medium hover:underline">{r.project.name}</Link>
                            <div className="max-w-[260px] truncate text-[12px] text-muted">{r.project.tagline}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] whitespace-nowrap text-muted">{fmtDateTime(r.submission.submittedAt)}</td>
                      <td className="px-4 py-3">
                        <span className="tabular">{r.evaluationCount}/{evaluatorTotal}</span>
                        {!r.viewerEvaluated && !published && <Badge tone="warn" className="ml-2">A sua falta</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right"><ScorePill score={r.score} /></td>
                      <td className="px-4 py-3">
                        {published ? <Badge tone={SUBMISSION_STATUS_TONE[r.submission.status]}>{SUBMISSION_STATUS_LABEL[r.submission.status]}</Badge> : <SubmissionStatusSelect submissionId={r.submission.id} status={r.submission.status} />}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ButtonLink href={`/evaluate/${r.submission.id}`} size="sm" variant={r.viewerEvaluated || published ? "secondary" : "primary"}>
                          {published ? "Abrir" : r.viewerEvaluated ? "Rever" : "Avaliar"}
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "compare" && <Compare board={b} ids={compareIds} challengeId={id} />}

      {tab === "evaluators" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Atribuídos" subtitle="Podem ver e avaliar todas as submissões deste desafio" />
            <ul className="divide-y divide-line/70">
              {(await evaluatorsDirectory()).map((ev) => {
                const assigned = b.evaluators.some((x) => x.id === ev.id);
                const done = b.rows.filter((r) => r.evaluations.some((e) => e.evaluatorId === ev.id)).length;
                return (
                  <li key={ev.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={ev.name} hue={ev.avatarHue} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">{ev.name} <RoleTag role={ev.role} /></div>
                      <div className="truncate text-[12px] text-muted">{assigned ? `${done}/${b.rows.length} avaliadas` : ev.headline}</div>
                    </div>
                    {ev.id !== user.id && !published && <EvaluatorToggle challengeId={id} evaluatorId={ev.id} assigned={assigned} />}
                    {(ev.id === user.id || published) && assigned && <Badge>Atribuído</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="p-5 text-sm text-ink-2">
            <h3 className="mb-2 font-semibold text-ink">Como funciona a avaliação</h3>
            <p>Cada avaliador atribui uma nota de 0 a 10 a cada critério. A nota da avaliação é a média ponderada pelos pesos (0–100) e a nota final da submissão é a média das avaliações completas.</p>
            <p className="mt-3">Os avaliadores não vêem as notas uns dos outros, para evitar efeito de ancoragem. Só o investidor vê o quadro completo.</p>
          </Card>
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-4">
          {published ? (
            <>
              <Notice tone="ok">Resultados publicados a {fmtDateTime(c.resultsPublishedAt!)}. Os rankings e o histórico foram actualizados.</Notice>
              <FinalResults rows={detail.results} />
            </>
          ) : c.status !== "closed" ? (
            <Card><EmptyState icon={<Scale className="size-5" />} title="Encerre as submissões para confirmar resultados">Os resultados só podem ser decididos depois de fechado o período de submissão.</EmptyState></Card>
          ) : b.rows.length === 0 ? (
            <Card><EmptyState title="Sem submissões para classificar" /></Card>
          ) : (
            <>
              {b.confirmed.length > 0 && (
                <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">Resultados confirmados — ainda privados</h2>
                    <p className="text-sm text-ink-2">Ao publicar, os membros vêem a classificação e o feedback, é criado um anúncio e os pontos de mérito são atribuídos.</p>
                  </div>
                  <PublishResultsButton challengeId={id} />
                </Card>
              )}
              {evalDone < evalExpected && <Notice tone="warn">Faltam {evalExpected - evalDone} avaliações. Pode confirmar na mesma, mas a nota final reflecte apenas as avaliações completas.</Notice>}
              <Card className="p-5">
                <h2 className="mb-1 font-semibold">{b.confirmed.length ? "Ajustar resultados" : "Confirmar resultados"}</h2>
                <p className="mb-4 text-sm text-muted">Vencer dá direito ao prémio. Oportunidades de investimento registam-se à parte, no pipeline.</p>
                <ResultsForm
                  challengeId={id}
                  prizes={b.prizes.map((p) => ({ id: p.id, title: p.title, value: p.value, rank: p.rank }))}
                  rows={b.rows.map((r) => ({
                    submissionId: r.submission.id,
                    projectName: r.project.name,
                    logoHue: r.project.logoHue,
                    score: r.score,
                    suggestedRank: r.rank,
                    evaluationCount: r.evaluationCount,
                    current: r.result ? { rank: r.result.rank, prizeId: r.result.prizeId, note: r.result.note } : null,
                  }))}
                />
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <Card>
          <CardHeader title="Histórico de decisões" subtitle="Registo cronológico, não editável" />
          <HistoryList items={b.history} />
        </Card>
      )}
    </div>
  );
}

function HistoryList({ items }: { items: HistoryEntry[] }) {
  if (items.length === 0) return <p className="p-5 text-sm text-muted">Sem registos.</p>;
  return (
    <ol className="divide-y divide-line/70">
      {items.map((h) => (
        <li key={h.id} className="flex gap-3 px-5 py-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" />
          <div>
            <p className="text-sm text-ink">{h.summary}</p>
            <p className="text-[12px] text-muted">{h.actorName} · {fmtDateTime(h.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function FinalResults({ rows }: { rows: ChallengeDetail["results"] }) {
  return (
    <Card className="divide-y divide-line/70">
      {rows.map((r) => (
        <div key={r.projectSlug} className="flex items-center gap-3 px-5 py-3">
          <RankMedal rank={r.rank} />
          <ProjectLogo name={r.projectName} hue={r.projectLogoHue} fileId={r.projectLogoFileId} size={34} />
          <div className="min-w-0 flex-1">
            <Link href={`/projects/${r.projectSlug}`} className="text-sm font-medium hover:underline">{r.projectName}</Link>
            <div className="text-[12px] text-muted">{r.prizeTitle ? `${r.prizeTitle} · ${r.prizeValue}` : "Sem prémio"}{r.note && ` · ${r.note}`}</div>
          </div>
          <ScorePill score={r.finalScore} />
        </div>
      ))}
    </Card>
  );
}

function Compare({ board, ids, challengeId }: { board: ReviewBoard; ids: string[]; challengeId: string }) {
  const cols = board.rows.filter((r) => ids.includes(r.submission.id));
  const toggle = (sid: string) => {
    const next = ids.includes(sid) ? ids.filter((x) => x !== sid) : [...ids, sid].slice(-5);
    return `/admin/challenges/${challengeId}?tab=compare&ids=${next.join(",")}`;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {board.rows.map((r) => (
          <Link key={r.submission.id} href={toggle(r.submission.id)} scroll={false} className={cx("flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset", ids.includes(r.submission.id) ? "bg-ink text-white ring-ink" : "bg-surface ring-line hover:ring-line-strong")}>
            {r.project.name}
          </Link>
        ))}
      </div>
      {cols.length === 0 ? (
        <Card><EmptyState title="Seleccione até 5 submissões para comparar" /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="w-56 px-4 py-3 text-left text-[12px] font-medium text-muted">Critério (peso)</th>
                {cols.map((r) => (
                  <th key={r.submission.id} className="px-4 py-3 text-left">
                    <Link href={`/evaluate/${r.submission.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                      <ProjectLogo name={r.project.name} hue={r.project.logoHue} fileId={r.project.logoFileId} size={26} /> {r.project.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {board.criteria.map((cr) => {
                const vals = cols.map((r) => r.criterionMeans[cr.id]);
                const max = Math.max(...vals.filter((v) => v !== undefined));
                return (
                  <tr key={cr.id}>
                    <td className="px-4 py-3">{cr.name} <span className="text-muted">({cr.weight})</span></td>
                    {cols.map((r) => {
                      const v = r.criterionMeans[cr.id];
                      return (
                        <td key={r.submission.id} className="px-4 py-3">
                          {v === undefined ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 overflow-hidden rounded-full bg-sunken">
                                <div className={cx("h-full rounded-full", v === max ? "bg-volt-strong" : "bg-ink/70")} style={{ width: `${v * 10}%` }} />
                              </div>
                              <span className={cx("tabular font-mono", v === max && "font-semibold")}>{fmtScore(v)}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="bg-sunken/40">
                <td className="px-4 py-3 font-semibold">Nota final</td>
                {cols.map((r) => <td key={r.submission.id} className="px-4 py-3"><ScorePill score={r.score} /></td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-muted">Avaliações</td>
                {cols.map((r) => <td key={r.submission.id} className="tabular px-4 py-3 text-muted">{r.evaluationCount}</td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-muted">Fase</td>
                {cols.map((r) => <td key={r.submission.id} className="px-4 py-3 text-muted">{STAGE_LABEL[r.project.stage]}</td>)}
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
