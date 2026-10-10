import { Award, CalendarClock, Check, ClipboardCheck, ExternalLink, FileText, Gauge, Lock, Pencil, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChallengeCover, PhaseBadge, phaseTimeline, RankMedal, ScorePill, StageBadge } from "@/components/domain";
import { Avatar, Badge, Breadcrumbs, ButtonLink, Card, CardHeader, cx, EmptyState, Notice, ProjectLogo, Prose, Tabs } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { PRIZE_KIND_LABEL } from "@/lib/labels";
import { getChallengeBySlug, type ChallengeDetail } from "@/server/challenges";
import { DomainError } from "@/server/errors";
import { feedbackForTeam } from "@/server/review";
import { requireUser } from "@/server/session";
import { EnrollButton } from "./enroll-button";

async function load(slug: string, user: Awaited<ReturnType<typeof requireUser>>) {
  try {
    return await getChallengeBySlug(slug, user);
  } catch (e) {
    if (e instanceof DomainError && e.code === "not_found") notFound();
    throw e;
  }
}

export async function generateMetadata(props: PageProps<"/challenges/[slug]">): Promise<Metadata> {
  const user = await requireUser();
  const { slug } = await props.params;
  return { title: (await load(slug, user)).challenge.title };
}

export default async function ChallengePage(props: PageProps<"/challenges/[slug]">) {
  const user = await requireUser();
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const d = await load(slug, user);
  const c = d.challenge;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";
  const totalWeight = d.criteria.reduce((s, x) => s + x.weight, 0);
  const myResult = d.viewerSubmission && d.resultsPublished ? d.results.find((r) => r.projectSlug === d.viewerSubmission!.projectSlug) : undefined;
  const feedback = d.viewerSubmission && d.resultsPublished ? await feedbackForTeam(user, d.viewerSubmission.s.id) : [];

  const tabs = [
    { key: "overview", label: "Visão geral" },
    { key: "rules", label: "Regras e critérios" },
    { key: "prizes", label: "Prémios", count: d.prizes.length },
    { key: "participants", label: "Participantes", count: d.participantCount },
    ...(d.resultsPublished || (d.isReviewer && d.results.length) ? [{ key: "results", label: "Resultados" }] : []),
  ].map((t) => ({ ...t, href: t.key === "overview" ? `/challenges/${slug}` : `/challenges/${slug}?tab=${t.key}` }));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Desafios", href: "/challenges" }, { label: c.title }]} />

      {sp.submitted && <Notice tone="ok">Submissão entregue. Pode editá-la até ao fim do prazo.</Notice>}
      {sp.updated && <Notice tone="ok">Submissão actualizada.</Notice>}

      <ChallengeHero d={d} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs active={tab} items={tabs} />
          <div className="mt-6 space-y-6">
            {tab === "overview" && (
              <>
                <Prose text={c.description} />
                <section>
                  <h2 className="mb-3 font-display text-xl font-semibold">Objectivos</h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {c.objectives.map((o) => (
                      <li key={o} className="flex gap-3 rounded-xl bg-surface p-3.5 text-sm ring-1 ring-line">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-volt-soft ring-1 ring-volt-strong/50">
                          <Check className="size-3.5" />
                        </span>
                        {o}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h2 className="mb-3 font-display text-xl font-semibold">Como vai ser avaliado</h2>
                  <CriteriaBars criteria={d.criteria} total={totalWeight} />
                </section>
              </>
            )}

            {tab === "rules" && (
              <>
                <section>
                  <h2 className="mb-3 font-display text-xl font-semibold">Regras de participação</h2>
                  <ol className="space-y-2">
                    {c.rules.map((r, i) => (
                      <li key={r} className="flex gap-3 text-[15px] text-ink-2">
                        <span className="tabular w-6 shrink-0 font-mono text-[13px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                        {r}
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h2 className="mb-1 font-display text-xl font-semibold">Critérios de avaliação</h2>
                  <p className="mb-4 text-sm text-muted">Cada avaliador atribui 0–10 por critério. A nota final (0–100) é a média ponderada das avaliações.</p>
                  <CriteriaBars criteria={d.criteria} total={totalWeight} detailed />
                </section>
                <section>
                  <h2 className="mb-3 font-display text-xl font-semibold">Instruções de submissão</h2>
                  <Card className="p-5">
                    <Prose text={c.submissionInstructions} />
                  </Card>
                </section>
              </>
            )}

            {tab === "prizes" && (
              <div className="space-y-3">
                {d.prizes.map((p) => (
                  <Card key={p.id} className="flex items-start gap-4 p-5">
                    <div className={cx("grid size-11 shrink-0 place-items-center rounded-xl", p.kind === "investment" ? "bg-violet-soft text-violet" : p.kind === "prize" ? "bg-volt-soft ring-1 ring-volt-strong/40" : "bg-sunken")}>
                      {p.kind === "investment" ? <Gauge className="size-5" /> : p.kind === "prize" ? <Trophy className="size-5" /> : <Award className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.title}</h3>
                        <Badge tone={p.kind === "investment" ? "violet" : "neutral"}>{PRIZE_KIND_LABEL[p.kind]}</Badge>
                      </div>
                      {p.description && <p className="mt-1 text-sm text-ink-2">{p.description}</p>}
                    </div>
                    <div className="text-right font-display text-xl font-semibold whitespace-nowrap">{p.value}</div>
                  </Card>
                ))}
                <p className="text-[13px] text-muted">
                  Os prémios são atribuídos de acordo com as regras deste desafio e com os resultados publicados pela No Competition; nenhuma participação garante um prémio. Oportunidades de investimento são processos separados, sujeitos a análise própria.
                </p>
              </div>
            )}

            {tab === "participants" &&
              (d.participants.length === 0 ? (
                <Card>
                  <EmptyState icon={<Users className="size-5" />} title={c.participantsVisible ? "Ainda sem participantes" : "Participantes privados"}>
                    {c.participantsVisible ? "Seja a primeira equipa a inscrever-se." : "Neste desafio a lista de participantes só é visível para o investidor e os avaliadores."}
                  </EmptyState>
                </Card>
              ) : (
                <Card className="divide-y divide-line/70">
                  {d.participants.map((p) => (
                    <div key={p.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <Link href={`/members/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={p.name} hue={p.avatarHue} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium hover:underline">{p.name}</div>
                          <div className="truncate text-[12px] text-muted">{p.headline}</div>
                        </div>
                      </Link>
                      {p.projectSlug ? (
                        <Link href={`/projects/${p.projectSlug}`} className="flex items-center gap-2.5 sm:w-64">
                          <ProjectLogo name={p.projectName!} hue={p.projectLogoHue!} fileId={p.projectLogoFileId} size={30} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{p.projectName}</span>
                          {p.submitted ? <Badge tone="ok">Submetido</Badge> : <StageBadge stage={p.projectStage!} />}
                        </Link>
                      ) : (
                        <span className="text-[13px] text-muted sm:w-64">A preparar projecto</span>
                      )}
                    </div>
                  ))}
                </Card>
              ))}

            {tab === "results" && (
              <div className="space-y-3">
                {!d.resultsPublished && <Notice tone="warn">Pré-visualização: estes resultados ainda não são visíveis para os membros.</Notice>}
                {d.results.map((r) => (
                  <Card key={r.projectSlug} className={cx("flex items-center gap-4 p-4", r.rank === 1 && "ring-2 ring-volt-strong")}>
                    <RankMedal rank={r.rank} />
                    <ProjectLogo name={r.projectName} hue={r.projectLogoHue} fileId={r.projectLogoFileId} />
                    <Link href={`/projects/${r.projectSlug}`} className="min-w-0 flex-1">
                      <div className="font-semibold hover:underline">{r.projectName}</div>
                      <div className="truncate text-[13px] text-muted">{r.projectTagline}</div>
                      {r.prizeTitle && <div className="mt-1 text-[13px] font-medium">{r.prizeTitle} · {r.prizeValue}</div>}
                    </Link>
                    <ScorePill score={r.finalScore} />
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <ParticipationPanel d={d} slug={slug} myRank={myResult?.rank} feedback={feedback.map((f) => f.feedback)} role={user.role} />
          </Card>
          <Card>
            <CardHeader title="Calendário" />
            <ol className="space-y-0 p-5">
              {[
                ["Abertura", c.startsAt],
                ["Prazo de submissão", c.submissionDeadline],
                ["Resultados", c.resultsPublishedAt ?? c.resultsDate],
              ].map(([label, date], i, arr) => {
                const past = (date as Date) < new Date() || (i === 2 && d.resultsPublished);
                return (
                  <li key={label as string} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < arr.length - 1 && <span className="absolute top-6 left-[11px] h-[calc(100%-20px)] w-px bg-line" aria-hidden />}
                    <span className={cx("grid size-6 shrink-0 place-items-center rounded-full", past ? "bg-ink text-white" : "bg-surface ring-1 ring-line-strong")}>
                      {past ? <Check className="size-3.5" /> : <CalendarClock className="size-3.5 text-muted" />}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{label as string}</div>
                      <div className="text-[13px] text-muted">{fmtDateTime(date as Date)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ChallengeHero({ d }: { d: ChallengeDetail }) {
  const c = d.challenge;
  const base = `hsl(${c.coverHue} 34% 14%)`;
  const topPrize = d.prizes[0];
  const facts: { label: string; value: React.ReactNode; hint?: string | null }[] = [
    { label: "Prazo de submissão", value: fmtDate(c.submissionDeadline), hint: phaseTimeline(c, d.phase) },
    ...(topPrize?.value ? [{ label: topPrize.title || "Prémio principal", value: topPrize.value, hint: d.prizes.length > 1 ? `+ ${d.prizes.length - 1} ${d.prizes.length === 2 ? "prémio" : "prémios"}` : null }] : []),
    { label: "Inscritos", value: d.participantCount, hint: d.submissionCount > 0 ? (d.submissionCount === 1 ? "1 submissão" : `${d.submissionCount} submissões`) : null },
    { label: "Equipas", value: `até ${c.maxTeamSize}`, hint: c.maxTeamSize === 1 ? "pessoa" : "pessoas" },
  ];
  return (
    <section aria-labelledby="challenge-title" className="overflow-hidden rounded-[22px] text-white" style={{ backgroundColor: base }}>
      <div className="relative">
        <div aria-hidden className="relative aspect-[2/1] sm:absolute sm:inset-y-0 sm:right-0 sm:aspect-auto sm:w-[48%]">
          <ChallengeCover hue={c.coverHue} seed={c.slug} theme={`${c.category} ${c.title}`} className="size-full" />
          <div className="absolute inset-0 sm:hidden" style={{ background: `linear-gradient(to top, ${base}, transparent 55%)` }} />
          <div className="absolute inset-0 hidden sm:block" style={{ background: `linear-gradient(to right, ${base}, transparent 70%)` }} />
        </div>
        <div className="relative px-5 pb-6 sm:max-w-[62%] sm:px-8 sm:py-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium">{c.category}</span>
            <PhaseBadge phase={d.phase} />
          </div>
          <h1 id="challenge-title" className="mt-4 font-display text-[28px] leading-[1.08] font-semibold sm:text-[40px]">{c.title}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-[16px]">{c.tagline}</p>
        </div>
      </div>
      <dl className="relative grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/10 bg-black/15 px-5 py-4 sm:grid-cols-4 sm:px-8">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="truncate text-[12px] text-white/60">{f.label}</dt>
            <dd className="tabular truncate font-display text-[18px] font-semibold sm:text-xl">{f.value}</dd>
            {f.hint && <dd className="truncate text-[12px] text-white/70">{f.hint}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function CriteriaBars({ criteria, total, detailed }: { criteria: { id: string; name: string; description: string; weight: number }[]; total: number; detailed?: boolean }) {
  return (
    <Card className="divide-y divide-line/70">
      {criteria.map((cr) => {
        const pct = Math.round((cr.weight / total) * 100);
        return (
          <div key={cr.id} className="p-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">{cr.name}</span>
              <span className="tabular font-mono text-sm font-semibold">{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
            {(detailed || cr.description) && <p className="mt-2 text-[13px] text-muted">{cr.description}</p>}
          </div>
        );
      })}
    </Card>
  );
}

function ParticipationPanel({
  d,
  slug,
  myRank,
  feedback,
  role,
}: {
  d: ChallengeDetail;
  slug: string;
  myRank?: number;
  feedback: string[];
  role: string;
}) {
  const c = d.challenge;
  if (role === "investor")
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-2">Está a ver o desafio como os membros o vêem.</p>
        <ButtonLink href={`/admin/challenges/${c.id}`} className="w-full" size="lg">
          <Gauge className="size-4" /> Gerir desafio
        </ButtonLink>
      </div>
    );
  if (role === "evaluator")
    return d.isReviewer ? (
      <div className="space-y-3">
        <p className="text-sm text-ink-2">Está atribuído(a) como avaliador(a) deste desafio.</p>
        <ButtonLink href={`/review/${c.id}`} className="w-full" size="lg">
          <ClipboardCheck className="size-4" /> Avaliar submissões
        </ButtonLink>
      </div>
    ) : (
      <p className="text-sm text-ink-2">Não está atribuído(a) a este desafio.</p>
    );

  const sub = d.viewerSubmission;
  if (sub)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">A sua submissão</h2>
          {d.resultsPublished ? (myRank ? <Badge tone="volt">{myRank}.º lugar</Badge> : <Badge>Concluído</Badge>) : <Badge tone="ok">Entregue</Badge>}
        </div>
        <Link href={`/projects/${sub.projectSlug}`} className="flex items-center gap-2 text-sm font-medium hover:underline">
          <FileText className="size-4 text-muted" /> {sub.projectName}
        </Link>
        <p className="line-clamp-3 text-[13px] text-ink-2">{sub.s.summary}</p>
        <a href={sub.s.deliverableUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[13px] font-medium text-info hover:underline">
          Ver entrega <ExternalLink className="size-3.5" />
        </a>
        <p className="text-[12px] text-muted">Última alteração {fmtDateTime(sub.s.updatedAt)}</p>
        {d.canSubmit && (
          <ButtonLink href={`/challenges/${slug}/submit`} variant="secondary" className="w-full">
            <Pencil className="size-4" /> Editar submissão
          </ButtonLink>
        )}
        {d.phase === "reviewing" && <Notice tone="info">Em avaliação. O feedback fica disponível quando os resultados forem publicados.</Notice>}
        {feedback.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <h3 className="text-sm font-semibold">Feedback dos avaliadores</h3>
            {feedback.map((f, i) => (
              <blockquote key={i} className="rounded-xl bg-sunken p-3 text-[13px] text-ink-2">
                “{f}”
              </blockquote>
            ))}
          </div>
        )}
      </div>
    );

  if (d.viewerParticipation)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Está inscrito(a)</h2>
          <Badge tone="info">Inscrito</Badge>
        </div>
        {d.canSubmit ? (
          <>
            <p className="text-sm text-ink-2">Quando estiver pronto(a), submeta o seu projecto. Pode editar até ao prazo.</p>
            <ButtonLink href={`/challenges/${slug}/submit`} variant="accent" size="lg" className="w-full">
              Submeter projecto
            </ButtonLink>
          </>
        ) : d.phase === "upcoming" ? (
          <p className="text-sm text-ink-2">As submissões abrem a {fmtDate(c.startsAt)}. Use o tempo para preparar o projecto.</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock className="size-4" /> As submissões estão fechadas.
          </p>
        )}
      </div>
    );

  if (d.canEnroll)
    return (
      <div className="space-y-4">
        <h2 className="font-semibold">Participar</h2>
        <p className="text-sm text-ink-2">Inscreva-se para receber anúncios do desafio e submeter o seu projecto até {fmtDate(c.submissionDeadline)}.</p>
        <EnrollButton challengeId={c.id} />
        <p className="text-center text-[12px] text-muted">+10 pontos de participação</p>
      </div>
    );

  return (
    <div className="space-y-2">
      <h2 className="font-semibold">Inscrições fechadas</h2>
      <p className="text-sm text-ink-2">
        {d.resultsPublished ? "Este desafio está concluído. Veja os resultados." : "Este desafio já não aceita novas inscrições."}
      </p>
    </div>
  );
}
