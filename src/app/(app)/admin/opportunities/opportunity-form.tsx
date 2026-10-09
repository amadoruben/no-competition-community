"use client";

import { opportunityAction } from "@/app/actions";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { OPPORTUNITY_STATUSES } from "@/db/schema";

const LABEL: Record<string, string> = { interest: "Interesse", due_diligence: "Due diligence", term_sheet: "Term sheet", invested: "Investido", declined: "Recusado" };

export function OpportunityForm({
  projects,
  challenges,
  initial,
}: {
  projects: { id: string; name: string }[];
  challenges: { id: string; title: string }[];
  initial?: { id: string; projectId: string; challengeId: string | null; status: string; amount: string; note: string };
}) {
  return (
    <ActionForm action={opportunityAction} resetOnSuccess={!initial} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field name="projectId" label="Projecto">
        <Select name="projectId" defaultValue={initial?.projectId ?? ""}>
          <option value="">Seleccione…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field name="challengeId" label="Origem (opcional)">
        <Select name="challengeId" defaultValue={initial?.challengeId ?? ""}>
          <option value="">Fora de desafios</option>
          {challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="status" label="Fase">
          <Select name="status" defaultValue={initial?.status ?? "interest"}>
            {OPPORTUNITY_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field name="amount" label="Montante indicativo">
          <Input name="amount" defaultValue={initial?.amount} placeholder="Ex.: €100.000" />
        </Field>
      </div>
      <Field name="note" label="Notas">
        <Textarea name="note" rows={3} defaultValue={initial?.note} placeholder="Tese, riscos, próximos passos." />
      </Field>
      <SubmitButton className="w-full" pendingLabel="A guardar…">{initial ? "Guardar" : "Registar oportunidade"}</SubmitButton>
    </ActionForm>
  );
}
