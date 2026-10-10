"use client";

import { commentAction } from "@/app/actions";
import { ActionForm, Field, SubmitButton, Textarea } from "@/components/form";

export function CommentForm({ postId }: { postId: string }) {
  return (
    <ActionForm action={commentAction.bind(null, postId)} resetOnSuccess className="space-y-3">
      <Field name="body" label="Responder">
        <Textarea name="body" rows={3} placeholder="Escreva um comentário construtivo…" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="A enviar…">Comentar</SubmitButton>
      </div>
    </ActionForm>
  );
}
