"use client";

import { addProjectMemberAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { Avatar } from "@/components/ui";

export function TeamManager({ projectId, team }: { projectId: string; team: { name: string; handle: string; title: string; hue: number }[] }) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg font-semibold">Equipa</h2>
      <ul className="space-y-3">
        {team.map((m) => (
          <li key={m.handle} className="flex items-center gap-3">
            <Avatar name={m.name} hue={m.hue} size={32} />
            <div>
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-[12px] text-muted">@{m.handle}{m.title && ` · ${m.title}`}</div>
            </div>
          </li>
        ))}
      </ul>
      <ActionForm action={addProjectMemberAction.bind(null, projectId)} resetOnSuccess className="grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field name="handle" label="Identificador do membro">
          <Input name="handle" placeholder="@bruno" />
        </Field>
        <Field name="title" label="Função">
          <Input name="title" placeholder="Ex.: CTO" />
        </Field>
        <SubmitButton variant="secondary">Adicionar</SubmitButton>
      </ActionForm>
    </div>
  );
}
