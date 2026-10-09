import { Plus, Rocket, Search, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/domain";
import { ButtonLink, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { STAGE_LABEL } from "@/lib/labels";
import { listProjects } from "@/server/projects";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Projectos" };

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const stage = typeof sp.stage === "string" ? sp.stage : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const rows = listProjects({ stage, q });
  const link = (s?: string) => `/projects?${new URLSearchParams({ ...(s ? { stage: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div>
      <PageHeader
        title="Projectos"
        description="O que a comunidade está a construir — do primeiro protótipo à tracção."
        actions={user.role === "member" && <ButtonLink href="/projects/new" variant="accent"><Plus className="size-4" /> Novo projecto</ButtonLink>}
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[["", "Todas as fases"], ...Object.entries(STAGE_LABEL)].map(([k, v]) => (
            <Link
              key={k}
              href={link(k || undefined)}
              className={cx("h-8 rounded-full px-3 text-[13px] leading-8 font-medium whitespace-nowrap ring-1 ring-inset", (stage ?? "") === k ? "bg-ink text-white ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-line-strong")}
            >
              {v}
            </Link>
          ))}
        </div>
        <form className="relative sm:w-64">
          {stage && <input type="hidden" name="stage" value={stage} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input name="q" defaultValue={q} placeholder="Procurar projectos" aria-label="Procurar projectos" className="h-9 w-full rounded-full bg-surface pr-3 pl-9 text-sm ring-1 ring-line ring-inset focus:ring-2 focus:ring-ink focus:outline-none" />
        </form>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Rocket className="size-5" />} title="Nenhum projecto encontrado">Experimente outro filtro ou termo de pesquisa.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
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
    </div>
  );
}
