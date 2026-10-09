"use client";

import { Megaphone, Pause, Play, Square, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { publishResultsAction, setChallengeStatusAction, setEvaluatorAction, setSubmissionStatusAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import type { ChallengeStatus } from "@/db/schema";
import { STATUS_TRANSITIONS } from "@/lib/challenge-state";

const ACTIONS: Record<string, { label: string; icon: typeof Play; variant: "accent" | "secondary" | "danger"; confirm?: string }> = {
  published: { label: "Publicar", icon: Play, variant: "accent", confirm: "Publicar o desafio? Fica visível para todos os membros." },
  paused: { label: "Pausar", icon: Pause, variant: "secondary" },
  closed: { label: "Encerrar submissões", icon: Square, variant: "danger", confirm: "Encerrar submissões? Os membros deixam de poder submeter ou editar." },
};

export function StatusControls({ id, status }: { id: string; status: ChallengeStatus }) {
  const options = STATUS_TRANSITIONS[status];
  if (!options.length) return null;
  return (
    <ActionForm action={setChallengeStatusAction.bind(null, id)} className="flex flex-wrap gap-2">
      {options.map((to) => {
        const a = ACTIONS[to];
        const label = to === "published" && status !== "draft" ? (status === "closed" ? "Reabrir submissões" : "Retomar") : a.label;
        return (
          <SubmitButton
            key={to}
            name="status"
            value={to}
            variant={to === "published" && status === "closed" ? "secondary" : a.variant}
            onClick={(e) => {
              if (a.confirm && !window.confirm(a.confirm)) e.preventDefault();
            }}
          >
            <a.icon className="size-4" /> {label}
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
      <SubmitButton
        variant="accent"
        size="lg"
        pendingLabel="A publicar…"
        onClick={(e) => {
          if (!window.confirm("Publicar resultados? Ficam visíveis para toda a comunidade, é criado um anúncio e os rankings são actualizados. Esta acção não pode ser revertida.")) e.preventDefault();
        }}
      >
        <Megaphone className="size-4" /> Publicar resultados
      </SubmitButton>
    </ActionForm>
  );
}
