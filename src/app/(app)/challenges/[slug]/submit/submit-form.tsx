"use client";

import { submitProjectAction } from "@/app/actions";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";

export function SubmitForm({
  challengeId,
  slug,
  projects,
  initial,
  editing,
}: {
  challengeId: string;
  slug: string;
  projects: { id: string; name: string }[];
  initial: { projectId: string; summary: string; details: string; deliverableUrl: string; videoUrl: string };
  editing: boolean;
}) {
  return (
    <ActionForm action={submitProjectAction.bind(null, challengeId, slug)} className="space-y-5">
      <Field name="projectId" label="Projecto" hint="A submissão fica associada à página pública do projecto.">
        <Select name="projectId" defaultValue={initial.projectId}>
          <option value="">Seleccione…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field name="summary" label="Resumo" hint="Até 400 caracteres: problema, solução e prova, em poucas frases.">
        <Textarea name="summary" rows={3} maxLength={400} defaultValue={initial.summary} />
      </Field>
      <Field name="details" label="Detalhes (opcional)" hint="Validação, métricas, próximos passos, limitações conhecidas.">
        <Textarea name="details" rows={6} defaultValue={initial.details} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="deliverableUrl" label="Link da entrega" hint="Demonstração, protótipo ou documento.">
          <Input name="deliverableUrl" type="url" placeholder="https://" defaultValue={initial.deliverableUrl} />
        </Field>
        <Field name="videoUrl" label="Vídeo (opcional)" hint="Até 3 minutos.">
          <Input name="videoUrl" type="url" placeholder="https://" defaultValue={initial.videoUrl} />
        </Field>
      </div>
      <div className="flex justify-end border-t border-line pt-5">
        <SubmitButton variant="accent" size="lg" pendingLabel="A submeter…">
          {editing ? "Guardar alterações" : "Submeter projecto"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
