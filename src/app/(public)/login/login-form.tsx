"use client";

import Link from "next/link";
import { loginAction } from "@/app/actions";
import { ActionForm, Field, Input, PasswordInput, SubmitButton } from "@/components/form";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Email">
        <Input name="email" type="email" autoComplete="email" inputMode="email" placeholder="nome@exemplo.com" className="h-12" required />
      </Field>
      <Field name="password" label="Palavra-passe">
        <PasswordInput name="password" autoComplete="current-password" className="h-12" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-[13.5px] font-medium text-gold-strong underline-offset-4 hover:underline">
          Esqueceu-se da palavra-passe?
        </Link>
      </div>
      <SubmitButton variant="accent" className="w-full font-semibold" size="lg" pendingLabel="A entrar…">
        Entrar
      </SubmitButton>
    </ActionForm>
  );
}
