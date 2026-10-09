"use client";

import { UserMinus } from "lucide-react";
import { addProjectMemberAction, removeProjectMemberAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/overlay";
import { Avatar, buttonClass } from "@/components/ui";

export function TeamManager({
  projectId,
  projectOwnerId,
  team,
}: {
  projectId: string;
  projectOwnerId: string;
  team: { id: string; name: string; handle: string; title: string; hue: number; fileId: string | null }[];
}) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg font-semibold">Equipa</h2>
      <ul className="divide-y divide-line/70">
        {team.map((m) => (
          <li key={m.handle} className="flex items-center gap-3 py-3">
            <Avatar name={m.name} hue={m.hue} fileId={m.fileId} size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-[12px] text-muted">@{m.handle}{m.title && ` · ${m.title}`}</div>
            </div>
            {m.id !== projectOwnerId && (
              <ActionForm action={removeProjectMemberAction.bind(null, projectId, m.id)} showMessages={false}>
                <ConfirmSubmit
                  title={`Remover ${m.name}?`}
                  description="Deixa de poder editar o projecto e de o submeter a desafios. As submissões já feitas mantêm-se."
                  confirmLabel="Remover da equipa"
                  tone="danger"
                  className={buttonClass("ghost", "sm")}
                >
                  <UserMinus className="size-4" /> Remover
                </ConfirmSubmit>
              </ActionForm>
            )}
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
