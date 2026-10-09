"use client";

import { useState } from "react";
import { requestResetAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { Notice } from "@/components/ui";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <Notice tone="ok">
        Se existir uma conta com esse email, enviámos um link para definir uma nova palavra-passe. Verifique também a pasta de spam.
      </Notice>
    );
  return (
    <ActionForm action={requestResetAction} onSuccess={() => setSent(true)} className="space-y-4">
      <Field name="email" label="Email">
        <Input name="email" type="email" autoComplete="email" placeholder="nome@empresa.pt" />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="A enviar…">
        Enviar link
      </SubmitButton>
    </ActionForm>
  );
}
