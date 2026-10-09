"use client";

import { updateProfileAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/form";
import type { User } from "@/db/schema";

export function ProfileForm({ user }: { user: Pick<User, "name" | "headline" | "bio" | "location" | "skills" | "websiteUrl" | "linkedinUrl" | "githubUrl"> }) {
  return (
    <ActionForm action={updateProfileAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Nome"><Input name="name" defaultValue={user.name} /></Field>
        <Field name="location" label="Localização"><Input name="location" defaultValue={user.location} /></Field>
      </div>
      <Field name="headline" label="Título" hint="Ex.: Fundadora da Voltaica · Engenheira de energia"><Input name="headline" defaultValue={user.headline} /></Field>
      <Field name="bio" label="Sobre si"><Textarea name="bio" defaultValue={user.bio} /></Field>
      <Field name="skills" label="Competências" hint="Separadas por vírgulas."><Input name="skills" defaultValue={user.skills.join(", ")} /></Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field name="websiteUrl" label="Website"><Input name="websiteUrl" type="url" defaultValue={user.websiteUrl ?? ""} placeholder="https://" /></Field>
        <Field name="linkedinUrl" label="LinkedIn"><Input name="linkedinUrl" type="url" defaultValue={user.linkedinUrl ?? ""} placeholder="https://" /></Field>
        <Field name="githubUrl" label="GitHub"><Input name="githubUrl" type="url" defaultValue={user.githubUrl ?? ""} placeholder="https://" /></Field>
      </div>
      <div className="flex justify-end border-t border-line pt-5"><SubmitButton pendingLabel="A guardar…">Guardar perfil</SubmitButton></div>
    </ActionForm>
  );
}
