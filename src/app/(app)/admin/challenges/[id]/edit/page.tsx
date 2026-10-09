import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateChallengeAction } from "@/app/actions";
import { ChallengeEditor } from "@/components/challenge-editor";
import { Card, PageHeader } from "@/components/ui";
import { getChallengeForEdit } from "@/server/challenges";
import { DomainError } from "@/server/errors";
import { reviewBoard } from "@/server/review";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Editar desafio" };

export default async function EditChallenge(props: PageProps<"/admin/challenges/[id]/edit">) {
  const user = await requireUser(["investor"]);
  const { id } = await props.params;
  let d;
  try {
    d = getChallengeForEdit(user, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (d.challenge.status === "results_published") redirect(`/admin/challenges/${id}`);
  const locked = reviewBoard(user, id).rows.some((r) => r.evaluations.length > 0);
  const c = d.challenge;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/challenges/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> {c.title}</Link>
      <PageHeader title="Editar desafio" description={c.status !== "draft" ? "O desafio está publicado: as alterações ficam visíveis de imediato e são registadas no histórico." : undefined} />
      <Card className="p-5 sm:p-7">
        <ChallengeEditor
          action={updateChallengeAction.bind(null, id)}
          submitLabel="Guardar alterações"
          criteriaLocked={locked}
          initial={{
            ...c,
            criteria: d.criteria.map((x) => ({ id: x.id, name: x.name, description: x.description, weight: x.weight })),
            prizes: d.prizes.map((p) => ({ id: p.id, rank: p.rank, title: p.title, description: p.description, value: p.value, kind: p.kind })),
          }}
        />
      </Card>
    </div>
  );
}
