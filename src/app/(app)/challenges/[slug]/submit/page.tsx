import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";
import { deadlineText } from "@/lib/format";
import { getChallengeBySlug } from "@/server/challenges";
import { DomainError } from "@/server/errors";
import { projectsForUser } from "@/server/projects";
import { requireUser } from "@/server/session";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Submeter projecto" };

export default async function SubmitPage(props: PageProps<"/challenges/[slug]/submit">) {
  const user = await requireUser(["member"]);
  const { slug } = await props.params;
  const sp = await props.searchParams;
  let d;
  try {
    d = getChallengeBySlug(slug, user);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (!d.canSubmit) redirect(`/challenges/${slug}`);
  const projects = projectsForUser(user.id);
  const sub = d.viewerSubmission?.s;
  const preselect = typeof sp.project === "string" ? projects.find((p) => p.slug === sp.project)?.id : undefined;
  const totalWeight = d.criteria.reduce((s, c) => s + c.weight, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/challenges/${slug}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {d.challenge.title}
      </Link>
      <PageHeader
        eyebrow={deadlineText(d.challenge.submissionDeadline)}
        title={sub ? "Editar submissão" : "Submeter projecto"}
        description={!d.viewerParticipation ? "Ao submeter fica automaticamente inscrito(a) no desafio." : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5 sm:p-6">
          {projects.length === 0 ? (
            <EmptyState
              title="Precisa de um projecto para submeter"
              action={<ButtonLink href={`/projects/new?returnTo=/challenges/${slug}/submit`} variant="accent"><Plus className="size-4" /> Criar projecto</ButtonLink>}
            >
              Crie a página do projecto — demora 2 minutos e pode completá-la depois.
            </EmptyState>
          ) : (
            <>
              {preselect && <Notice tone="ok" className="mb-5">Projecto criado e seleccionado.</Notice>}
              <SubmitForm
                challengeId={d.challenge.id}
                slug={slug}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                editing={!!sub}
                initial={{
                  projectId: preselect ?? sub?.projectId ?? (projects.length === 1 ? projects[0].id : ""),
                  summary: sub?.summary ?? "",
                  details: sub?.details ?? "",
                  deliverableUrl: sub?.deliverableUrl ?? "",
                  videoUrl: sub?.videoUrl ?? "",
                }}
              />
              <p className="mt-4 text-[13px] text-muted">
                Projecto novo?{" "}
                <Link href={`/projects/new?returnTo=/challenges/${slug}/submit`} className="font-medium text-ink underline underline-offset-4">
                  Criar outro projecto
                </Link>
              </p>
            </>
          )}
        </Card>
        <aside className="space-y-4">
          <Card>
            <CardHeader title="Critérios" subtitle="O que os avaliadores vão pontuar" />
            <ul className="divide-y divide-line/70">
              {d.criteria.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-[12px] text-muted">{c.description}</div>
                  </div>
                  <span className="tabular font-mono text-sm font-semibold">{Math.round((c.weight / totalWeight) * 100)}%</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 text-sm text-ink-2">
            <h3 className="mb-2 font-semibold text-ink">Instruções</h3>
            {d.challenge.submissionInstructions}
          </Card>
        </aside>
      </div>
    </div>
  );
}
