import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhaseBadge, ScorePill } from "@/components/domain";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, ProjectLogo } from "@/components/ui";
import { challengePhase } from "@/lib/challenge-state";
import { DomainError } from "@/server/errors";
import { reviewBoard } from "@/server/review";
import { requireUser } from "@/server/session";

export default async function ReviewChallenge(props: PageProps<"/review/[challengeId]">) {
  const user = await requireUser(["evaluator", "investor"]);
  const { challengeId } = await props.params;
  let b;
  try {
    b = await reviewBoard(user, challengeId);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  // Evaluators see only their own scores, to avoid anchoring on colleagues.
  const rows = [...b.rows].sort((a, z) => Number(a.viewerEvaluated) - Number(z.viewerEvaluated) || +a.submission.submittedAt - +z.submission.submittedAt);
  return (
    <div>
      <Link href="/review" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Avaliações</Link>
      <PageHeader eyebrow={<PhaseBadge phase={challengePhase(b.challenge)} />} title={b.challenge.title} description={`${b.pendingForViewer} por avaliar · ${b.rows.length} submissões`} />
      <Card className="divide-y divide-line/70">
        {rows.length === 0 && <EmptyState title="Ainda sem submissões" />}
        {rows.map((r) => {
          const mine = r.evaluations.find((e) => e.evaluatorId === user.id);
          return (
            <div key={r.submission.id} className="flex items-center gap-3 px-5 py-4">
              <ProjectLogo name={r.project.name} hue={r.project.logoHue} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.project.name}</div>
                <div className="truncate text-[13px] text-muted">{r.project.tagline}</div>
              </div>
              {mine ? <ScorePill score={mine.score} /> : <Badge tone="warn">Por avaliar</Badge>}
              <ButtonLink href={`/evaluate/${r.submission.id}`} size="sm" variant={mine ? "secondary" : "primary"}>{mine ? "Rever" : "Avaliar"}</ButtonLink>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
