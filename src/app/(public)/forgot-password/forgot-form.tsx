"use client";

import { MailCheck } from "lucide-react";
import { useState } from "react";
import { requestResetAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div role="status" className="rounded-2xl bg-ok-soft p-5 text-ok">
        <MailCheck className="size-6" />
        <p className="mt-3 text-[15px] font-semibold">Verifique o seu email</p>
        <p className="mt-1 text-[14px] leading-relaxed">
          Se existir uma conta com esse email, enviámos um link para definir uma nova palavra-passe. Verifique também a pasta de spam.
        </p>
      </div>
    );
  return (
    <ActionForm action={requestResetAction} onSuccess={() => setSent(true)} className="space-y-4">
      <Field name="email" label="Email">
        <Input name="email" type="email" autoComplete="email" inputMode="email" placeholder="nome@exemplo.com" className="h-12" />
      </Field>
      <SubmitButton variant="accent" className="w-full font-semibold" size="lg" pendingLabel="A enviar…">
        Enviar link
      </SubmitButton>
    </ActionForm>
  );
}
