import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, cx, Notice, PageHeader, ProjectLogo } from "@/components/ui";
import { OPPORTUNITY_STATUSES } from "@/db/schema";
import { timeAgo } from "@/lib/format";
import { listChallenges } from "@/server/challenges";
import { projectOptions } from "@/server/projects";
import { listOpportunities, OPPORTUNITY_LABEL } from "@/server/review";
import { requireUser } from "@/server/session";
import { OpportunityForm } from "./opportunity-form";

export const metadata: Metadata = { title: "Pipeline de investimento" };

export default async function OpportunitiesPage(props: PageProps<"/admin/opportunities">) {
  const user = await requireUser(["investor"]);
  const sp = await props.searchParams;
  const opps = await listOpportunities(user);
  const projects = await projectOptions();
  const challenges = (await listChallenges(user)).map((c) => ({ id: c.id, title: c.title }));
  const editing = typeof sp.edit === "string" ? opps.find((o) => o.o.id === sp.edit) : undefined;
  const preProject = typeof sp.project === "string" ? sp.project : undefined;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Painel</Link>
      <PageHeader title="Pipeline de investimento" description="Separado dos resultados dos desafios: vencer não implica financiamento, e qualquer projecto pode entrar no pipeline." />
      <Notice tone="info">Registo de decisões apenas. A plataforma não processa pagamentos, transferências nem contratos.</Notice>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {OPPORTUNITY_STATUSES.map((st) => {
            const col = opps.filter((o) => o.o.status === st);
            return (
              <div key={st} className="w-64 shrink-0 lg:w-auto lg:flex-1">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[13px] font-semibold">{OPPORTUNITY_LABEL[st]}</span>
                  <span className="tabular rounded-full bg-sunken px-2 text-[12px] text-muted">{col.length}</span>
                </div>
                <div className="min-h-24 space-y-2 rounded-2xl bg-sunken/60 p-2">
                  {col.map((o) => (
                    <Link key={o.o.id} href={`/admin/opportunities?edit=${o.o.id}`} scroll={false} className={cx("block rounded-xl bg-surface p-3 ring-1 transition-shadow hover:shadow-[var(--shadow-card)]", editing?.o.id === o.o.id ? "ring-ink" : "ring-line")}>
                      <div className="flex items-center gap-2">
                        <ProjectLogo name={o.projectName} hue={o.projectLogoHue} fileId={o.projectLogoFileId} size={26} />
                        <span className="truncate text-sm font-semibold">{o.projectName}</span>
                      </div>
                      <div className="mt-2 font-display text-lg font-semibold">{o.o.amount || "—"}</div>
                      {o.challengeTitle && <div className="truncate text-[12px] text-muted">via {o.challengeTitle}</div>}
                      {o.o.note && <p className="mt-1.5 line-clamp-3 text-[12px] text-ink-2">{o.o.note}</p>}
                      <div className="mt-2 text-[11px] text-muted">Actualizado {timeAgo(o.o.updatedAt)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <Card>
          <CardHeader title={editing ? `Editar · ${editing.projectName}` : "Registar oportunidade"} action={editing && <Link href="/admin/opportunities" className="text-sm text-muted hover:text-ink">Nova</Link>} />
          <div className="p-5">
            <OpportunityForm
              key={editing?.o.id ?? preProject ?? "new"}
              projects={projects}
              challenges={challenges}
              initial={editing ? { id: editing.o.id, projectId: editing.o.projectId, challengeId: editing.o.challengeId, status: editing.o.status, amount: editing.o.amount, note: editing.o.note } : preProject ? { id: "", projectId: preProject, challengeId: null, status: "interest", amount: "", note: "" } : undefined}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
