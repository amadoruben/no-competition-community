import { ArrowLeft, ArrowRight, ExternalLink, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonLine, ScorePill, StageBadge } from "@/components/domain";
import { Badge, ButtonLink, Card, CardHeader, Notice, ProjectLogo, Prose } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { SUBMISSION_STATUS_LABEL, SUBMISSION_STATUS_TONE } from "@/lib/labels";
import { DomainError } from "@/server/errors";
import { getSubmissionForReview } from "@/server/review";
import { requireUser } from "@/server/session";
import { ScoreForm } from "./score-form";

export const metadata: Metadata = { title: "Avaliar submissão" };

export default async function EvaluatePage(props: PageProps<"/evaluate/[submissionId]">) {
  const user = await requireUser(["investor", "evaluator"]);
  const { submissionId } = await props.params;
  let d;
  try {
    d = getSubmissionForReview(user, submissionId);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const { row, challenge: c } = d;
  const s = row.submission;
  const p = row.project;
  const investor = user.role === "investor";
  const locked = c.status === "results_published";
  const back = investor ? `/admin/challenges/${c.id}?tab=submissions` : `/review/${c.id}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={back} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> {c.title}</Link>
        <div className="flex gap-2">
          {d.prevId && <ButtonLink href={`/evaluate/${d.prevId}`} variant="ghost" size="sm"><ArrowLeft className="size-4" /> Anterior</ButtonLink>}
          {d.nextId && <ButtonLink href={`/evaluate/${d.nextId}`} variant="secondary" size="sm">Seguinte <ArrowRight className="size-4" /></ButtonLink>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <ProjectLogo name={p.name} hue={p.logoHue} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold">{p.name}</h1>
                  <StageBadge stage={p.stage} />
                  {investor && <Badge tone={SUBMISSION_STATUS_TONE[s.status]}>{SUBMISSION_STATUS_LABEL[s.status]}</Badge>}
                </div>
                <p className="mt-1 text-ink-2">{p.tagline}</p>
                <p className="mt-1 text-[13px] text-muted">Submetido por {row.submitterName} · {fmtDateTime(s.submittedAt)}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={s.deliverableUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink-2">Abrir entrega <ExternalLink className="size-3.5" /></a>
              {s.videoUrl && <a href={s.videoUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-[13px] font-medium ring-1 ring-line-strong hover:bg-sunken"><PlayCircle className="size-4" /> Vídeo</a>}
              <Link href={`/projects/${p.slug}`} className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-ink-2 hover:bg-sunken">Página do projecto</Link>
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Resumo da submissão</h2>
            <p className="text-[16px] leading-relaxed">{s.summary}</p>
            {s.details && (
              <>
                <h2 className="mt-6 mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Detalhes</h2>
                <Prose text={s.details} />
              </>
            )}
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5"><div className="text-[12px] font-semibold tracking-wide text-muted uppercase">Problema</div><Prose text={p.problem || "—"} className="mt-2 text-sm" /></Card>
            <Card className="p-5"><div className="text-[12px] font-semibold tracking-wide text-ok uppercase">Solução</div><Prose text={p.solution || "—"} className="mt-2 text-sm" /></Card>
          </div>
          <Card>
            <CardHeader title="Equipa" />
            <ul className="grid gap-3 p-5 sm:grid-cols-2">
              {d.team.map((t) => <li key={t.handle}><PersonLine name={t.name} handle={t.handle} hue={t.avatarHue} sub={t.title} /></li>)}
            </ul>
          </Card>
          {investor && row.evaluations.length > 0 && (
            <Card>
              <CardHeader title="Todas as avaliações" subtitle={`Nota final ${row.score === null ? "—" : row.score.toFixed(1).replace(".", ",")} · média de ${row.evaluationCount}`} />
              <ul className="divide-y divide-line/70">
                {row.evaluations.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{e.evaluatorName}</span>
                      <ScorePill score={e.score} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                      {d.criteria.map((cr) => <span key={cr.id}>{cr.name}: <b className="tabular text-ink">{e.scores[cr.id]}</b></span>)}
                    </div>
                    {e.feedback && <p className="mt-2 text-sm text-ink-2">“{e.feedback}”</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">A sua avaliação</h2>
              {d.mine ? <Badge tone="ok">Guardada</Badge> : <Badge tone="warn">Por avaliar</Badge>}
            </div>
            {locked && <Notice tone="info" className="mb-4">Resultados publicados — avaliações fechadas.</Notice>}
            {!locked && c.status !== "closed" && <Notice tone="info" className="mb-4">As submissões ainda estão abertas: a equipa pode actualizar a entrega até ao prazo.</Notice>}
            <ScoreForm submissionId={s.id} criteria={d.criteria} initial={d.mine?.scores ?? {}} feedback={d.mine?.feedback ?? ""} locked={locked} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
