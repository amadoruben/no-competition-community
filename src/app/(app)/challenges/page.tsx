import { Plus, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { ChallengeCard } from "@/components/domain";
import { ButtonLink, Card, CardHeader, cx, EmptyState, PageHeader, ProjectLogo, Tabs } from "@/components/ui";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { listChallenges, recentWinners } from "@/server/challenges";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Desafios" };

const FILTERS: { key: string; label: string; phases: ChallengePhase[] | null }[] = [
  { key: "all", label: "Todos", phases: null },
  { key: "open", label: "Abertos", phases: ["open"] },
  { key: "upcoming", label: "Em breve", phases: ["upcoming"] },
  { key: "reviewing", label: "Em avaliação", phases: ["reviewing", "paused"] },
  { key: "done", label: "Concluídos", phases: ["results"] },
  { key: "mine", label: "Os meus", phases: null },
];

export default async function ChallengesPage(props: PageProps<"/challenges">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const active = FILTERS.some((f) => f.key === sp.f) ? String(sp.f) : "all";
  const [all, winners] = await Promise.all([listChallenges(user), recentWinners()]);
  const filters = user.role === "member" ? FILTERS : [...FILTERS.filter((f) => f.key !== "mine"), { key: "draft", label: "Rascunhos", phases: ["draft"] as ChallengePhase[] }];
  const f = filters.find((x) => x.key === active) ?? filters[0];
  const list = all.filter((c) => (f.key === "mine" ? c.viewerEnrolled : !f.phases || f.phases.includes(challengePhase(c))));
  // Open first, then upcoming, reviewing, results.
  const order: ChallengePhase[] = ["open", "upcoming", "paused", "reviewing", "results", "draft"];
  list.sort((a, b) => order.indexOf(challengePhase(a)) - order.indexOf(challengePhase(b)));

  return (
    <div>
      <PageHeader
        title="Desafios"
        description="Desafios da No Competition. Regras, datas, critérios de avaliação e prémios ficam públicos antes de começar."
        actions={user.role === "investor" && (
          <ButtonLink href="/admin/challenges/new" variant="accent">
            <Plus className="size-4" /> Novo desafio
          </ButtonLink>
        )}
      />
      <Tabs
        active={f.key}
        items={filters
          .map((x) => ({
            key: x.key,
            label: x.label,
            href: x.key === "all" ? "/challenges" : `/challenges?f=${x.key}`,
            count: all.filter((c) => (x.key === "mine" ? c.viewerEnrolled : !x.phases || x.phases.includes(challengePhase(c)))).length,
          }))
          // Empty views are noise: keep "Todos" and the current tab.
          .filter((x) => x.key === "all" || x.key === f.key || x.count > 0)}
      />
      <div className="mt-6">
        {list.length === 0 ? (
          <Card>
            <EmptyState icon={<Zap className="size-5" />} title="Nenhum desafio nesta vista">
              {f.key === "mine" ? "Inscreva-se num desafio aberto para o acompanhar aqui." : user.role === "investor" ? "Crie o primeiro desafio: tema, regras, critérios com pesos e prémios." : "Os novos desafios são anunciados no Início. Quando abrirem, aparecem aqui com as regras e os prémios."}
            </EmptyState>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <ChallengeCard key={c.id} c={c} href={user.role === "investor" && c.status === "draft" ? `/admin/challenges/${c.id}` : undefined} />
            ))}
          </div>
        )}
      </div>
      {winners.length > 0 && (
        <Card className="mt-8">
          <CardHeader title="Vencedores" subtitle="Resultados publicados dos desafios concluídos" />
          <ul className="divide-y divide-line/70">
            {winners.map((w) => (
              <li key={`${w.challengeSlug}-${w.rank}`} className="flex items-center gap-3 px-5 py-3">
                <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold", w.rank === 1 ? "bg-volt text-ink" : "bg-sunken text-muted")}>
                  {w.rank === 1 ? <Trophy className="size-4" /> : `${w.rank}.º`}
                </span>
                <ProjectLogo name={w.projectName} hue={w.logoHue} fileId={w.logoFileId} size={32} />
                <div className="min-w-0 flex-1">
                  <Link href={`/projects/${w.projectSlug}`} className="block truncate text-sm font-medium hover:underline">{w.projectName}</Link>
                  <Link href={`/challenges/${w.challengeSlug}?tab=results`} className="block truncate text-[12px] text-muted hover:underline">{w.challengeTitle}{w.prize ? ` · ${w.prize}` : ""}</Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
