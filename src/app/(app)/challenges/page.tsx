import { Plus, Zap } from "lucide-react";
import type { Metadata } from "next";
import { ChallengeCard } from "@/components/domain";
import { ButtonLink, Card, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { challengePhase, type ChallengePhase } from "@/lib/challenge-state";
import { listChallenges } from "@/server/challenges";
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
  const all = await listChallenges(user);
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
        description="Problemas reais lançados pelo investidor, com critérios, prazos e prémios públicos."
        actions={user.role === "investor" && (
          <ButtonLink href="/admin/challenges/new" variant="accent">
            <Plus className="size-4" /> Novo desafio
          </ButtonLink>
        )}
      />
      <Tabs
        active={f.key}
        items={filters.map((x) => ({
          key: x.key,
          label: x.label,
          href: x.key === "all" ? "/challenges" : `/challenges?f=${x.key}`,
          count: all.filter((c) => (x.key === "mine" ? c.viewerEnrolled : !x.phases || x.phases.includes(challengePhase(c)))).length,
        }))}
      />
      <div className="mt-6">
        {list.length === 0 ? (
          <Card>
            <EmptyState icon={<Zap className="size-5" />} title="Nenhum desafio nesta vista">
              {f.key === "mine" ? "Inscreva-se num desafio aberto para o acompanhar aqui." : "Volte em breve — novos desafios são anunciados na comunidade."}
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
    </div>
  );
}
