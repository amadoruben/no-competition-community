"use client";

import { confirmResultsAction } from "@/app/actions";
import { ActionForm, controlClass, SubmitButton } from "@/components/form";
import { ProjectLogo, cx } from "@/components/ui";
import { fmtScore } from "@/lib/format";

export interface ResultsRow {
  submissionId: string;
  projectName: string;
  logoHue: number;
  score: number | null;
  suggestedRank: number | null;
  evaluationCount: number;
  current: { rank: number; prizeId: string | null; note: string } | null;
}

export function ResultsForm({ challengeId, rows, prizes }: { challengeId: string; rows: ResultsRow[]; prizes: { id: string; title: string; value: string; rank: number | null }[] }) {
  const hasConfirmed = rows.some((r) => r.current);
  return (
    <ActionForm action={confirmResultsAction.bind(null, challengeId)} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="py-2 pr-3 font-medium">Projecto</th>
              <th className="px-3 py-2 text-right font-medium">Nota</th>
              <th className="px-3 py-2 font-medium">Posição final</th>
              <th className="px-3 py-2 font-medium">Prémio</th>
              <th className="py-2 pl-3 font-medium">Justificação (opcional)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const defaultRank = r.current?.rank ?? (!hasConfirmed && r.suggestedRank && r.suggestedRank <= 3 ? r.suggestedRank : "");
              const defaultPrize = r.current?.prizeId ?? (!hasConfirmed ? (prizes.find((p) => p.rank === r.suggestedRank)?.id ?? "") : "");
              return (
                <tr key={r.submissionId} className="border-b border-line/60 last:border-0">
                  <td className="py-3 pr-3">
                    <input type="hidden" name="submissionId" value={r.submissionId} />
                    <span className="flex items-center gap-2.5">
                      <ProjectLogo name={r.projectName} hue={r.logoHue} size={28} />
                      <span className="font-medium">{r.projectName}</span>
                    </span>
                  </td>
                  <td className="tabular px-3 py-3 text-right font-mono">
                    {fmtScore(r.score)}
                    <div className="text-[11px] text-muted">{r.evaluationCount} aval.</div>
                  </td>
                  <td className="px-3 py-3">
                    <select name={`rank:${r.submissionId}`} defaultValue={String(defaultRank)} aria-label={`Posição de ${r.projectName}`} className={cx(controlClass, "h-9 w-32 text-sm")}>
                      <option value="">Sem posição</option>
                      {rows.map((_, i) => <option key={i} value={i + 1}>{i + 1}.º lugar</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select name={`prize:${r.submissionId}`} defaultValue={defaultPrize} aria-label={`Prémio de ${r.projectName}`} className={cx(controlClass, "h-9 w-48 text-sm")}>
                      <option value="">Nenhum</option>
                      {prizes.map((p) => <option key={p.id} value={p.id}>{p.title}{p.value && ` · ${p.value}`}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pl-3">
                    <input name={`note:${r.submissionId}`} defaultValue={r.current?.note ?? ""} placeholder="Ex.: desempate pela tracção" className={cx(controlClass, "h-9 text-sm")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">As posições sugeridas seguem a nota. Pode alterá-las — a decisão e a justificação ficam no histórico.</p>
        <SubmitButton pendingLabel="A confirmar…">{hasConfirmed ? "Actualizar resultados" : "Confirmar resultados"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
