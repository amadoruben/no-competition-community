"use client";

import { registerAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";

export function RegisterForm() {
  return (
    <ActionForm action={registerAction} className="space-y-4">
      <Field name="name" label="Nome">
        <Input name="name" autoComplete="name" placeholder="O seu nome" />
      </Field>
      <Field name="email" label="Email">
        <Input name="email" type="email" autoComplete="email" placeholder="nome@empresa.pt" />
      </Field>
      <Field name="password" label="Palavra-passe" hint="Pelo menos 8 caracteres.">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="A criar conta…">
        Criar conta
      </SubmitButton>
    </ActionForm>
  );
}
