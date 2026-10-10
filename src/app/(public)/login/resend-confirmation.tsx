"use client";

import { resendConfirmationAction } from "@/app/actions";
import { ActionForm, Field, FormMessage, Input, SubmitButton } from "@/components/form";

/** For accounts whose confirmation email was lost or expired. */
export function ResendConfirmation({ open }: { open?: boolean }) {
  return (
    <details open={open} className="mt-6 rounded-2xl bg-surface p-4 text-sm ring-1 ring-line">
      <summary className="cursor-pointer font-medium">Não recebeu o email de confirmação?</summary>
      <ActionForm action={resendConfirmationAction} className="mt-4 space-y-3" resetOnSuccess showMessages={false}>
        <Field name="email" id="resend-email" label="Email da conta">
          <Input name="email" id="resend-email" type="email" autoComplete="email" placeholder="nome@empresa.pt" />
        </Field>
        <SubmitButton variant="secondary" className="w-full" pendingLabel="A enviar…">
          Enviar novo link
        </SubmitButton>
        <FormMessage showSuccess />
        <p className="text-[13px] text-muted">O link é válido durante pouco tempo e só pode ser usado uma vez. Verifique também a pasta de spam.</p>
      </ActionForm>
    </details>
  );
}
