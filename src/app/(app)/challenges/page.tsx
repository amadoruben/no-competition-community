import { ArrowRight, CalendarClock, Plus, Trophy, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChallengeCard, ChallengeCover, PhaseBadge, phaseTimeline } from "@/components/domain";
import { Badge, ButtonLink, Card, cx, EmptyState, FilterChips, PageHeader, ProjectLogo, SectionTitle } from "@/components/ui";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { plural } from "@/lib/format";
import { listChallenges, recentWinners, type ChallengeCard as ChallengeData } from "@/server/challenges";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Desafios" };

const SECTIONS: { key: string; title: string; subtitle: string; phases: ChallengePhase[] }[] = [
  { key: "open", title: "Inscrições abertas", subtitle: "Inscreva-se e submeta até ao prazo.", phases: ["open"] },
  { key: "upcoming", title: "Em breve", subtitle: "As inscrições abrem na data indicada.", phases: ["upcoming"] },
  { key: "reviewing", title: "Em avaliação", subtitle: "Submissões fechadas; resultados na data indicada.", phases: ["reviewing", "paused"] },
  { key: "done", title: "Concluídos", subtitle: "Resultados publicados.", phases: ["results"] },
];

const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

export default async function ChallengesPage(props: PageProps<"/challenges">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const [all, winners] = await Promise.all([listChallenges(user), recentWinners()]);
  const mineOnly = sp.f === "mine" && user.role === "member";
  const withPhase = all.map((c) => ({ ...c, phase: challengePhase(c) }));
  const visible = withPhase.filter((c) => c.phase !== "draft" && (!mineOnly || c.viewerEnrolled));
  const drafts = user.role === "investor" ? withPhase.filter((c) => c.phase === "draft") : [];
  const enrolled = withPhase.filter((c) => c.viewerEnrolled).length;

  // The challenge to feature: the open one closing soonest, else the next to open.
  const byDeadline = (a: ChallengeData, b: ChallengeData) => +a.submissionDeadline - +b.submissionDeadline;
  const featured = mineOnly ? undefined : (visible.filter((c) => c.phase === "open").sort(byDeadline)[0] ?? visible.filter((c) => c.phase === "upcoming").sort((a, b) => +a.startsAt - +b.startsAt)[0]);
  const rest = visible.filter((c) => c !== featured);
  // Sections with one card share a row, so a quiet season does not leave half-empty rows.
  const filled = SECTIONS.map((s) => ({ ...s, items: rest.filter((c) => s.phases.includes(c.phase)).sort(byDeadline) })).filter((s) => s.items.length);
  const rows: (typeof filled)[] = [];
  for (const s of filled) {
    const last = rows.at(-1);
    if (s.items.length === 1 && last && last.length < 3 && last.every((x) => x.items.length === 1)) last.push(s);
    else rows.push([s]);
  }

  return (
    <div className="space-y-10">
      <div>
        <PageHeader
          title="Desafios"
          description="Desafios da No Competition. Regras, datas, critérios de avaliação e prémios ficam públicos antes de começar."
          actions={
            user.role === "investor" && (
              <ButtonLink href="/admin/challenges/new" variant="accent">
                <Plus className="size-4" /> Novo desafio
              </ButtonLink>
            )
          }
        />
        {user.role === "member" && enrolled > 0 && (
          <FilterChips
            label="Filtrar desafios"
            active={mineOnly ? "mine" : "all"}
            items={[
              { key: "all", label: "Todos", href: "/challenges" },
              { key: "mine", label: `Os meus (${enrolled})`, href: "/challenges?f=mine" },
            ]}
          />
        )}
      </div>

      {visible.length === 0 && drafts.length === 0 && (
        <Card>
          <EmptyState icon={<Zap />} title={mineOnly ? "Ainda não se inscreveu em nenhum desafio" : "Ainda não há desafios publicados"} action={user.role === "investor" && <ButtonLink href="/admin/challenges/new" variant="accent"><Plus className="size-4" /> Criar o primeiro desafio</ButtonLink>}>
            {mineOnly ? "Os desafios em que se inscrever aparecem aqui." : user.role === "investor" ? "Defina tema, regras, datas, critérios com pesos e prémios. Fica em rascunho até o publicar." : "Os novos desafios são anunciados no Início. Quando abrirem, aparecem aqui com as regras e os prémios."}
          </EmptyState>
        </Card>
      )}

      {featured && <FeaturedChallenge c={featured} />}

      {rows.map((row) =>
        row.length > 1 ? (
          <div key={row.map((s) => s.key).join("-")} className={grid}>
            {row.map((s) => (
              <section key={s.key} aria-labelledby={`sec-${s.key}`} className="flex flex-col">
                <SectionTitle id={`sec-${s.key}`} title={s.title} subtitle={s.subtitle} />
                <div className="flex-1">
                  <ChallengeCard c={s.items[0]} />
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section key={row[0].key} aria-labelledby={`sec-${row[0].key}`}>
            <SectionTitle id={`sec-${row[0].key}`} title={row[0].title} subtitle={row[0].subtitle} />
            <div className={grid}>
              {row[0].items.map((c) => (
                <ChallengeCard key={c.id} c={c} />
              ))}
            </div>
          </section>
        ),
      )}

      {drafts.length > 0 && (
        <section aria-labelledby="sec-drafts">
          <SectionTitle id="sec-drafts" title="Rascunhos" subtitle="Só a administração vê estes desafios até serem publicados." />
          <div className={grid}>
            {drafts.map((c) => (
              <ChallengeCard key={c.id} c={c} href={`/admin/challenges/${c.id}`} />
            ))}
          </div>
        </section>
      )}

      {winners.length > 0 && !mineOnly && (
        <section aria-labelledby="sec-winners">
          <SectionTitle id="sec-winners" title="Vencedores" subtitle="Resultados publicados dos desafios concluídos." />
          <Card>
            <ul className="divide-y divide-line/70">
              {winners.map((w) => (
                <li key={`${w.challengeSlug}-${w.rank}`} className="flex items-center gap-4 px-5 py-3.5">
                  <span className={cx("grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold", w.rank === 1 ? "bg-gold text-ink" : "bg-sunken text-ink-2")}>
                    {w.rank === 1 ? <Trophy className="size-4" /> : `${w.rank}.º`}
                  </span>
                  <ProjectLogo name={w.projectName} hue={w.logoHue} fileId={w.logoFileId} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${w.projectSlug}`} className="block truncate text-[15px] font-semibold hover:underline">{w.projectName}</Link>
                    <Link href={`/challenges/${w.challengeSlug}?tab=results`} className="block truncate text-[13px] text-muted hover:underline">
                      {w.challengeTitle}
                    </Link>
                  </div>
                  {w.prize && <Badge tone={w.rank === 1 ? "gold" : "neutral"} className="hidden sm:inline-flex">{w.prize}</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

function FeaturedChallenge({ c }: { c: ChallengeData & { phase: ChallengePhase } }) {
  return (
    <Link href={`/challenges/${c.slug}`} className="group block rounded-[22px]">
      <div className="grid overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/80 transition group-hover:shadow-[var(--shadow-pop)] md:grid-cols-[1.1fr_1fr]">
        <ChallengeCover hue={c.coverHue} seed={c.slug} theme={`${c.category} ${c.title}`} className="aspect-[16/9] md:aspect-auto md:min-h-[320px]">
          <div className="flex h-full items-start justify-between gap-2 p-4">
            <span className="rounded-full bg-black/35 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">{c.category}</span>
          </div>
        </ChallengeCover>
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={c.phase} />
            <span className="text-[12px] font-semibold tracking-[0.1em] text-muted uppercase">Em destaque</span>
          </div>
          <h2 className="mt-3 font-display text-[26px] leading-[1.1] font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4 sm:text-[32px]">{c.title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{c.tagline}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
            <div>
              <dt className="text-[12px] text-muted">Prazo</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-semibold"><CalendarClock className="size-4" /> {phaseTimeline(c, c.phase)}</dd>
            </div>
            {c.topPrize?.value && (
              <div>
                <dt className="text-[12px] text-muted">{c.topPrize.title || "Prémio principal"}</dt>
                <dd className="mt-0.5 font-display text-[20px] font-semibold">{c.topPrize.value}</dd>
              </div>
            )}
            {c.participantCount > 0 && (
              <div>
                <dt className="text-[12px] text-muted">Inscritos</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-semibold"><Users className="size-4" /> {plural(c.participantCount, "pessoa", "pessoas")}</dd>
              </div>
            )}
            {(c.viewerEnrolled || c.viewerSubmitted) && (
              <div>
                <dt className="text-[12px] text-muted">A sua participação</dt>
                <dd className="mt-1">{c.viewerSubmitted ? <Badge tone="ok">Submetido</Badge> : <Badge tone="info">Inscrito</Badge>}</dd>
              </div>
            )}
          </dl>
          <span className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition group-hover:bg-ink-2">
            Ver desafio <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
