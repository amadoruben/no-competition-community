"use client";

import { useState } from "react";
import { createPostAction } from "@/app/actions";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Avatar } from "@/components/ui";

export function Composer({
  name,
  hue,
  canAnnounce,
  challenges,
}: {
  name: string;
  hue: number;
  canAnnounce: boolean;
  challenges: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 text-left shadow-[var(--shadow-card)] ring-1 ring-line/70 hover:ring-line-strong"
      >
        <Avatar name={name} hue={hue} size={38} />
        <span className="flex-1 text-[15px] text-muted">Partilhe uma pergunta, ideia ou progresso…</span>
        <span className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">Publicar</span>
      </button>
    );
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-line/70 sm:p-5">
      <ActionForm action={createPostAction} resetOnSuccess onSuccess={() => setOpen(false)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="kind" label="Tipo">
            <Select name="kind" defaultValue="discussion">
              <option value="discussion">Discussão</option>
              <option value="question">Pergunta</option>
              <option value="progress">Progresso</option>
              {canAnnounce && <option value="announcement">Anúncio oficial</option>}
            </Select>
          </Field>
          <Field name="challengeId" label="Desafio relacionado (opcional)">
            <Select name="challengeId" defaultValue="">
              <option value="">Nenhum</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field name="title" label="Título">
          <Input name="title" autoFocus placeholder="Sobre o que quer falar?" />
        </Field>
        <Field name="body" label="Texto">
          <Textarea name="body" rows={4} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full px-4 text-sm font-medium text-muted hover:bg-sunken">
            Cancelar
          </button>
          <SubmitButton pendingLabel="A publicar…">Publicar</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
