"use client";

import { completeResetAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={completeResetAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="Nova palavra-passe" hint="Pelo menos 8 caracteres.">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field name="confirm" label="Confirmar palavra-passe">
        <Input name="confirm" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="A guardar…">
        Guardar e entrar
      </SubmitButton>
    </ActionForm>
  );
}
