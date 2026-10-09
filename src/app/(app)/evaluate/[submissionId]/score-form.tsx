"use client";

import { useState } from "react";
import { saveEvaluationAction } from "@/app/actions";
import { ActionForm, Field, SubmitButton, Textarea } from "@/components/form";
import { cx } from "@/components/ui";

export function ScoreForm({
  submissionId,
  criteria,
  initial,
  feedback,
  locked,
}: {
  submissionId: string;
  criteria: { id: string; name: string; description: string; weight: number }[];
  initial: Record<string, number>;
  feedback: string;
  locked: boolean;
}) {
  const [scores, setScores] = useState<Record<string, number | undefined>>(initial);
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  const complete = criteria.every((c) => scores[c.id] !== undefined);
  const live = complete ? (criteria.reduce((s, c) => s + (scores[c.id] ?? 0) * c.weight, 0) / total) * 10 : null;

  return (
    <ActionForm action={saveEvaluationAction.bind(null, submissionId)} className="space-y-5">
      {criteria.map((c) => (
        <fieldset key={c.id} disabled={locked} className="space-y-2">
          <legend className="flex w-full items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">{c.name}</span>
            <span className="text-[12px] text-muted">peso {Math.round((c.weight / total) * 100)}%</span>
          </legend>
          {c.description && <p className="text-[12px] text-muted">{c.description}</p>}
          <input type="hidden" name={`score:${c.id}`} value={scores[c.id] ?? ""} />
          <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={c.name}>
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={scores[c.id] === n}
                onClick={() => setScores((s) => ({ ...s, [c.id]: n }))}
                className={cx(
                  "tabular h-9 rounded-lg font-mono text-[13px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50",
                  scores[c.id] === n ? "bg-ink text-white ring-ink" : scores[c.id] !== undefined && n < scores[c.id]! ? "bg-volt-soft ring-volt-strong/40" : "bg-surface ring-line hover:ring-ink",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <Field name="feedback" label="Feedback para a equipa" hint="Visível para a equipa quando os resultados forem publicados. Seja específico e construtivo.">
        <Textarea name="feedback" rows={4} defaultValue={feedback} disabled={locked} />
      </Field>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <div className="text-[12px] text-muted">A sua nota</div>
          <div className="tabular font-display text-2xl font-semibold">{live === null ? "—" : live.toFixed(1).replace(".", ",")}<span className="text-sm text-muted">/100</span></div>
        </div>
        {!locked && <SubmitButton disabled={!complete} pendingLabel="A guardar…">Guardar avaliação</SubmitButton>}
      </div>
    </ActionForm>
  );
}
