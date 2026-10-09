"use client";

import { Megaphone, Pause, Play, Square, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { publishResultsAction, setChallengeStatusAction, setEvaluatorAction, setSubmissionStatusAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { ConfirmSubmit } from "@/components/overlay";
import { buttonClass } from "@/components/ui";
import type { ChallengeStatus } from "@/db/schema";
import { STATUS_TRANSITIONS } from "@/lib/challenge-state";

const ACTIONS: Record<string, { label: string; icon: typeof Play; variant: "accent" | "secondary" | "danger"; confirm?: string }> = {
  published: { label: "Publicar", icon: Play, variant: "accent", confirm: "O desafio fica visível para todos os membros e passa a aceitar inscrições." },
  paused: { label: "Pausar", icon: Pause, variant: "secondary" },
  closed: { label: "Encerrar submissões", icon: Square, variant: "danger", confirm: "Os membros deixam de poder submeter ou editar entregas. Pode reabrir mais tarde." },
};

export function StatusControls({ id, status }: { id: string; status: ChallengeStatus }) {
  const options = STATUS_TRANSITIONS[status];
  if (!options.length) return null;
  return (
    <ActionForm action={setChallengeStatusAction.bind(null, id)} className="flex flex-wrap gap-2">
      {options.map((to) => {
        const a = ACTIONS[to];
        const label = to === "published" && status !== "draft" ? (status === "closed" ? "Reabrir submissões" : "Retomar") : a.label;
        const variant = to === "published" && status === "closed" ? "secondary" : a.variant;
        const content = (
          <>
            <a.icon className="size-4" /> {label}
          </>
        );
        return a.confirm ? (
          <ConfirmSubmit key={to} name="status" value={to} title={`${label}?`} description={a.confirm} confirmLabel={label} tone={variant === "danger" ? "danger" : variant === "accent" ? "accent" : "primary"} className={buttonClass(variant)}>
            {content}
          </ConfirmSubmit>
        ) : (
          <SubmitButton key={to} name="status" value={to} variant={variant}>
            {content}
          </SubmitButton>
        );
      })}
    </ActionForm>
  );
}

export function EvaluatorToggle({ challengeId, evaluatorId, assigned }: { challengeId: string; evaluatorId: string; assigned: boolean }) {
  return (
    <ActionForm action={setEvaluatorAction.bind(null, challengeId)} showMessages={false}>
      <input type="hidden" name="evaluatorId" value={evaluatorId} />
      <input type="hidden" name="assigned" value={assigned ? "0" : "1"} />
      <SubmitButton size="sm" variant={assigned ? "ghost" : "secondary"}>
        {assigned ? <><UserMinus className="size-4" /> Remover</> : <><UserPlus className="size-4" /> Atribuir</>}
      </SubmitButton>
    </ActionForm>
  );
}

export function SubmissionStatusSelect({ submissionId, status }: { submissionId: string; status: string }) {
  const [value, setValue] = useState(status);
  return (
    <ActionForm action={setSubmissionStatusAction.bind(null, submissionId)} showMessages={false}>
      <select
        name="status"
        aria-label="Estado da submissão"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.currentTarget.form?.requestSubmit();
        }}
        className="h-8 rounded-full bg-surface px-2.5 text-[12px] font-medium ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-ink focus:outline-none"
      >
        <option value="submitted">Submetido</option>
        <option value="shortlisted">Shortlist</option>
        <option value="not_selected">Não seleccionado</option>
      </select>
    </ActionForm>
  );
}

export function PublishResultsButton({ challengeId }: { challengeId: string }) {
  return (
    <ActionForm action={publishResultsAction.bind(null, challengeId)}>
      <ConfirmSubmit
        title="Publicar resultados?"
        description="Ficam visíveis para toda a comunidade, é criado um anúncio, o feedback é entregue às equipas e os pontos de mérito são atribuídos. Esta acção não pode ser revertida."
        confirmLabel="Publicar resultados"
        tone="accent"
        className={buttonClass("accent", "lg")}
      >
        <Megaphone className="size-4" /> Publicar resultados
      </ConfirmSubmit>
    </ActionForm>
  );
}
