"use client";

import { loginAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Email">
        <Input name="email" type="email" autoComplete="email" placeholder="nome@empresa.pt" required />
      </Field>
      <Field name="password" label="Palavra-passe">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="A entrar…">
        Entrar
      </SubmitButton>
    </ActionForm>
  );
}
