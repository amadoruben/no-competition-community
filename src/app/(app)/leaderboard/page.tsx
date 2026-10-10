import { Info, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RankMedal, ScorePill } from "@/components/domain";
import { MembersSwitch } from "@/components/members-switch";
import { Avatar, Card, CardHeader, cx, EmptyState, PageHeader, ProjectLogo, Tabs } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { POINT_RULES } from "@/lib/points";
import { getChallengeBySlug, listChallenges } from "@/server/challenges";
import { leaderboard, type LeaderboardView } from "@/server/leaderboard";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Classificações" };

const VIEWS: { key: LeaderboardView | "challenge"; label: string; hint: string }[] = [
  { key: "overall", label: "Geral", hint: "Participação + mérito, desde sempre." },
  { key: "weekly", label: "Semanal", hint: "Pontos ganhos nos últimos 7 dias." },
  { key: "merit", label: "Mérito", hint: "Apenas notas e classificações em desafios com resultados publicados." },
  { key: "participation", label: "Participação", hint: "Inscrições, submissões, progresso, comunidade e aprendizagem." },
  { key: "challenge", label: "Por desafio", hint: "Resultados finais publicados de cada desafio." },
];

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const view = VIEWS.find((v) => v.key === sp.v) ?? VIEWS[0];
  const tabs = VIEWS.map((v) => ({ key: v.key, label: v.label, href: v.key === "overall" ? "/leaderboard" : `/leaderboard?v=${v.key}` }));

  return (
    <div>
      <MembersSwitch active="leaderboard" />
      <PageHeader title="Classificação" description="Participação e mérito medidos em separado, com regras públicas. Popularidade não conta." />
      <Tabs active={view.key} items={tabs} />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">{view.key === "challenge" ? <ByChallenge user={user} selected={typeof sp.c === "string" ? sp.c : undefined} /> : <Standings view={view.key} hint={view.hint} me={user.id} />}</div>
        <aside>
          <Card>
            <CardHeader title="Como funcionam os pontos" />
            <div className="space-y-4 p-5 text-sm">
              <div>
                <div className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">Participação</div>
                <ul className="space-y-1.5 text-ink-2">
                  {[
                    ["Inscrição num desafio", POINT_RULES.enrollment],
                    ["Submissão entregue", POINT_RULES.submission],
                    ["Actualização de projecto (1/dia)", POINT_RULES.projectUpdate],
                    ["Publicação na comunidade", POINT_RULES.post],
                    ["Comentário", POINT_RULES.comment],
                    ["Aula concluída", POINT_RULES.lessonCompleted],
                  ].map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3">
                      <span>{k}</span>
                      <span className="tabular font-mono font-semibold text-ink">+{v}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-muted">Comunidade limitada a {POINT_RULES.communityDailyCap} pontos por dia.</p>
              </div>
              <div className="border-t border-line pt-4">
                <div className="mb-2 text-[12px] font-semibold tracking-wide text-ok uppercase">Mérito</div>
                <p className="text-ink-2">Só nasce de resultados publicados: a nota final (0–100) mais os pontos de classificação definidos por cada desafio (ex.: 300 / 200 / 100).</p>
              </div>
              <p className="flex gap-2 rounded-xl bg-sunken p-3 text-[13px] text-ink-2">
                <Info className="mt-0.5 size-4 shrink-0" /> Reacções e seguidores não dão pontos.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

async function Standings({ view, hint, me }: { view: LeaderboardView; hint: string; me: string }) {
  const rows = await leaderboard(view);
  const value = (r: (typeof rows)[number]) => (view === "merit" ? r.merit : view === "participation" ? r.participation : r.total);
  if (rows.length === 0)
    return (
      <Card>
        <EmptyState icon={<Trophy className="size-5" />} title="Ainda sem pontos neste período">{hint}</EmptyState>
      </Card>
    );
  const podium = rows.slice(0, 3);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{hint}</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[podium[1], podium[0], podium[2]].map((r, i) =>
          r ? (
            <Link key={r.userId} href={`/members/${r.handle}`} className={cx("flex flex-col items-center rounded-2xl p-3 text-center ring-1 transition-shadow hover:shadow-[var(--shadow-pop)] sm:p-5", i === 1 ? "bg-ink text-white ring-ink sm:-translate-y-2" : "bg-surface ring-line")}>
              <Avatar name={r.name} hue={r.avatarHue} size={i === 1 ? 56 : 44} />
              <div className="mt-2 w-full truncate text-sm font-semibold">{r.name}</div>
              <div className={cx("tabular font-display text-2xl font-semibold", i === 1 && "text-volt")}>{value(r)}</div>
              <div className={cx("text-[12px]", i === 1 ? "text-white/60" : "text-muted")}>{r.rank}.º lugar</div>
            </Link>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
      <Card>
        <div className="grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b border-line/70 px-4 py-2.5 text-[12px] font-medium text-muted sm:grid-cols-[40px_1fr_90px_90px_80px]">
          <span>#</span>
          <span>Membro</span>
          <span className="hidden text-right sm:block">Participação</span>
          <span className="hidden text-right sm:block">Mérito</span>
          <span className="text-right">Pontos</span>
        </div>
        <ol>
          {rows.map((r) => (
            <li key={r.userId} className={cx("grid grid-cols-[40px_1fr_auto] items-center gap-3 border-b border-line/50 px-4 py-2.5 last:border-0 sm:grid-cols-[40px_1fr_90px_90px_80px]", r.userId === me && "bg-volt-soft")}>
              <RankMedal rank={r.rank} />
              <Link href={`/members/${r.handle}`} className="flex min-w-0 items-center gap-3">
                <Avatar name={r.name} hue={r.avatarHue} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium hover:underline">{r.name}{r.userId === me && " (você)"}</span>
                  <span className="block truncate text-[12px] text-muted">{r.headline}</span>
                </span>
              </Link>
              <span className="tabular hidden text-right text-sm text-ink-2 sm:block">{r.participation}</span>
              <span className="tabular hidden text-right text-sm text-ok sm:block">{r.merit}</span>
              <span className="tabular text-right font-mono text-sm font-semibold">{value(r)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

async function ByChallenge({ user, selected }: { user: Awaited<ReturnType<typeof requireUser>>; selected?: string }) {
  const done = (await listChallenges(user)).filter((c) => c.status === "results_published");
  if (done.length === 0)
    return (
      <Card>
        <EmptyState icon={<Trophy className="size-5" />} title="Ainda não há resultados publicados" />
      </Card>
    );
  const current = done.find((c) => c.slug === selected) ?? done[0];
  const d = await getChallengeBySlug(current.slug, user);
  return (
    <div className="space-y-4">
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {done.map((c) => (
          <Link key={c.id} href={`/leaderboard?v=challenge&c=${c.slug}`} className={cx("h-8 rounded-full px-3 text-[13px] leading-8 font-medium whitespace-nowrap ring-1 ring-inset", c.id === current.id ? "bg-ink text-white ring-ink" : "bg-surface ring-line")}>
            {c.title}
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader title={d.challenge.title} subtitle={`Publicados a ${fmtDate(d.challenge.resultsPublishedAt!)} · ${d.submissionCount} submissões`} action={<Link href={`/challenges/${d.challenge.slug}?tab=results`} className="text-sm font-medium hover:underline">Ver desafio</Link>} />
        <ol className="divide-y divide-line/70">
          {d.results.map((r) => (
            <li key={r.projectSlug} className="flex items-center gap-3 px-4 py-3">
              <RankMedal rank={r.rank} />
              <ProjectLogo name={r.projectName} hue={r.projectLogoHue} size={36} />
              <Link href={`/projects/${r.projectSlug}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold hover:underline">{r.projectName}</div>
                <div className="truncate text-[12px] text-muted">{r.prizeTitle ? `${r.prizeTitle} · ${r.prizeValue}` : r.projectTagline}</div>
              </Link>
              <ScorePill score={r.finalScore} />
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
