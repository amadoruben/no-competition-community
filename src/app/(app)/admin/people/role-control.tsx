"use client";

import { accessTierAction, changeRoleAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/form";

export function RoleControl({ userId, role }: { userId: string; role: "member" | "evaluator" }) {
  const next = role === "member" ? "evaluator" : "member";
  return (
    <ActionForm action={changeRoleAction.bind(null, userId)} showMessages={false}>
      <input type="hidden" name="role" value={next} />
      <SubmitButton variant={next === "evaluator" ? "secondary" : "ghost"} size="sm" pendingLabel="A guardar…">
        {next === "evaluator" ? "Tornar avaliador(a)" : "Voltar a membro"}
      </SubmitButton>
    </ActionForm>
  );
}

export function AccessControl({ userId, tier }: { userId: string; tier: "free" | "full" }) {
  const next = tier === "full" ? "free" : "full";
  return (
    <ActionForm action={accessTierAction.bind(null, userId)} showMessages={false}>
      <input type="hidden" name="accessTier" value={next} />
      <SubmitButton variant={next === "full" ? "secondary" : "ghost"} size="sm" pendingLabel="A guardar…">
        {next === "full" ? "Dar acesso completo" : "Retirar acesso completo"}
      </SubmitButton>
    </ActionForm>
  );
}
