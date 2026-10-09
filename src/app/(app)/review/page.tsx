import { ArrowRight, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChallengeCover, PhaseBadge } from "@/components/domain";
import { Card, cx, EmptyState, PageHeader, Progress } from "@/components/ui";
import { fmtDay } from "@/lib/format";
import { evaluatorOverview } from "@/server/admin";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Avaliações" };

export default async function ReviewHome() {
  const user = await requireUser(["evaluator", "investor"]);
  if (user.role === "investor") redirect("/admin");
  const rows = evaluatorOverview(user);
  const pending = rows.reduce((s, r) => s + (r.phase === "results" ? 0 : r.viewerPending), 0);
  return (
    <div>
      <PageHeader eyebrow={`Olá, ${user.name.split(" ")[0]}`} title="As suas avaliações" description={pending ? `Tem ${pending} ${pending === 1 ? "submissão" : "submissões"} por avaliar.` : "Está em dia com todas as avaliações."} />
      {rows.length === 0 ? (
        <Card><EmptyState icon={<ClipboardCheck className="size-5" />} title="Ainda não foi atribuído(a) a nenhum desafio">A investidora atribui avaliadores a cada desafio.</EmptyState></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const mine = r.submissions - r.viewerPending;
            return (
              <Link key={r.id} href={`/review/${r.id}`} className="group">
                <Card className="flex h-full overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-pop)]">
                  <ChallengeCover hue={r.coverHue} className="w-3 shrink-0" />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold group-hover:underline">{r.title}</h2>
                      <PhaseBadge phase={r.phase} />
                    </div>
                    <p className="mt-1 text-[13px] text-muted">{r.submissions} submissões · prazo {fmtDay(r.submissionDeadline)}</p>
                    <div className="mt-auto pt-5">
                      <div className="mb-1.5 flex justify-between text-[12px]">
                        <span className={cx(r.viewerPending && r.phase !== "results" ? "font-medium text-warn" : "text-muted")}>{r.phase === "results" ? "Concluído" : r.viewerPending ? `${r.viewerPending} por avaliar` : "Tudo avaliado"}</span>
                        <span className="tabular text-muted">{mine}/{r.submissions}</span>
                      </div>
                      <Progress value={r.submissions ? (mine / r.submissions) * 100 : 0} tone="volt" />
                    </div>
                  </div>
                  <ArrowRight className="m-5 size-4 self-center text-faint" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
