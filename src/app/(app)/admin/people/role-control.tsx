"use client";

import { changeRoleAction } from "@/app/actions";
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
