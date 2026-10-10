"use client";

import { registerAction } from "@/app/actions";
import { ActionForm, Field, Input, PasswordInput, SubmitButton } from "@/components/form";

export function RegisterForm() {
  return (
    <ActionForm action={registerAction} className="space-y-4">
      <Field name="name" label="Nome">
        <Input name="name" autoComplete="name" placeholder="O seu nome" className="h-12" />
      </Field>
      <Field name="email" label="Email">
        <Input name="email" type="email" autoComplete="email" inputMode="email" placeholder="nome@exemplo.com" className="h-12" />
      </Field>
      <Field name="password" label="Palavra-passe" hint="Pelo menos 8 caracteres.">
        <PasswordInput name="password" autoComplete="new-password" className="h-12" />
      </Field>
      <SubmitButton variant="accent" className="w-full font-semibold" size="lg" pendingLabel="A criar conta…">
        Criar conta
      </SubmitButton>
    </ActionForm>
  );
}
