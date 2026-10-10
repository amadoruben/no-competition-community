"use client";

import { projectUpdateAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/form";

export function UpdateForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={projectUpdateAction.bind(null, projectId)} resetOnSuccess className="space-y-4">
      <Field name="title" label="Título">
        <Input name="title" placeholder="Ex.: Primeiro cliente pagante" />
      </Field>
      <Field name="body" label="O que mudou?">
        <Textarea name="body" rows={3} placeholder="Resultados, aprendizagens, próximos passos." />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="shareToFeed" defaultChecked className="size-4 accent-ink" /> Partilhar no feed da comunidade
        </label>
        <SubmitButton pendingLabel="A publicar…">Publicar actualização</SubmitButton>
      </div>
    </ActionForm>
  );
}
