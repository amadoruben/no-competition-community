"use client";

import { completeResetAction } from "@/app/actions";
import { ActionForm, Field, PasswordInput, SubmitButton } from "@/components/form";

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={completeResetAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="Nova palavra-passe" hint="Pelo menos 8 caracteres.">
        <PasswordInput name="password" autoComplete="new-password" className="h-12" />
      </Field>
      <Field name="confirm" label="Confirmar palavra-passe">
        <PasswordInput name="confirm" autoComplete="new-password" className="h-12" />
      </Field>
      <SubmitButton variant="accent" className="w-full font-semibold" size="lg" pendingLabel="A guardar…">
        Guardar e entrar
      </SubmitButton>
    </ActionForm>
  );
}
