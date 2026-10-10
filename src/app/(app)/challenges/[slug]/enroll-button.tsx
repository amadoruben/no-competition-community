"use client";

import { enrollAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/form";

export function EnrollButton({ challengeId }: { challengeId: string }) {
  return (
    <ActionForm action={enrollAction.bind(null, challengeId)}>
      <SubmitButton variant="accent" size="lg" className="w-full" pendingLabel="A inscrever…">
        Inscrever-me no desafio
      </SubmitButton>
    </ActionForm>
  );
}
