import { Plus, Rocket, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { ProjectCard } from "@/components/domain";
import { ButtonLink, Card, EmptyState, FilterChips, PageHeader, Pagination, SearchBox } from "@/components/ui";
import { STAGE_LABEL } from "@/lib/labels";
import { listProjects, PROJECT_SORTS } from "@/server/projects";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Projectos" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const stage = one(sp.stage);
  const q = one(sp.q);
  const sort = one(sp.sort) ?? "recent";
  const page = Number(one(sp.page) ?? 1) || 1;
  const res = await listProjects({ stage, q, sort, page });
  const link = (o: { stage?: string; sort?: string; page?: number }) => {
    const params = new URLSearchParams();
    const st = "stage" in o ? o.stage : stage;
    const so = "sort" in o ? o.sort : sort;
    if (st) params.set("stage", st);
    if (q) params.set("q", q);
    if (so && so !== "recent") params.set("sort", so);
    if (o.page && o.page > 1) params.set("page", String(o.page));
    const qs = params.toString();
    return qs ? `/projects?${qs}` : "/projects";
  };

  return (
    <div>
      <PageHeader
        title="Projectos"
        description="O que a comunidade está a construir — do primeiro protótipo à tracção."
        actions={user.role === "member" && <ButtonLink href="/projects/new" variant="accent"><Plus className="size-4" /> Novo projecto</ButtonLink>}
      />
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips label="Fase" active={stage ?? ""} items={[{ key: "", label: "Todas as fases", href: link({ stage: undefined }) }, ...Object.entries(STAGE_LABEL).map(([k, v]) => ({ key: k, label: v, href: link({ stage: k }) }))]} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterChips label="Ordenar" active={sort} items={Object.entries(PROJECT_SORTS).map(([k, v]) => ({ key: k, label: v, href: link({ sort: k }) }))} />
          <SearchBox defaultValue={q} placeholder="Procurar projectos" label="Procurar projectos" hidden={{ stage, sort: sort === "recent" ? undefined : sort }} />
        </div>
      </div>
      {res.rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Rocket className="size-5" />} title="Nenhum projecto encontrado" action={(q || stage) && <ButtonLink href="/projects" variant="secondary">Limpar filtros</ButtonLink>}>
            Experimente outro filtro ou termo de pesquisa.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.rows.map((r) => (
            <ProjectCard
              key={r.p.id}
              p={r.p}
              meta={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{r.ownerName}{r.memberCount > 1 && ` +${r.memberCount - 1}`}</span>
                  {r.challengeCount > 0 && <span>{r.challengeCount} {r.challengeCount === 1 ? "desafio" : "desafios"}</span>}
                  {r.bestRank && r.bestRank <= 3 && (
                    <span className="flex items-center gap-1 font-medium text-ink"><Trophy className="size-3.5" /> {r.bestRank}.º lugar</span>
                  )}
                </span>
              }
            />
          ))}
        </div>
      )}
      <Pagination page={res.page} pages={res.pages} total={res.total} label={res.total === 1 ? "projecto" : "projectos"} href={(n) => link({ page: n })} />
    </div>
  );
}
