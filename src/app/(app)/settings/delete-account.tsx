"use client";

import { deleteAccountAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";

export function DeleteAccount({ email }: { email: string }) {
  return (
    <ActionForm action={deleteAccountAction} className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Eliminar conta</h2>
        <p className="mt-1 text-sm text-muted">
          Apaga o seu perfil, fotografia, publicações, comentários, reacções e progresso, e a sua identidade de acesso. Não pode ser desfeito. Contas com projectos,
          submissões ou avaliações não podem ser eliminadas aqui — contacte-nos.
        </p>
      </div>
      <Field name="confirm" label={<>Para confirmar, escreva <span className="font-semibold">{email}</span></>}>
        <Input name="confirm" type="email" autoComplete="off" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="danger" pendingLabel="A eliminar…">
          Eliminar a minha conta
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
