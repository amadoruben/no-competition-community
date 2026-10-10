"use client";

import { updateProfileAction } from "@/app/actions";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/form";
import { PlatformTile } from "@/components/social/platform-icon";
import type { User } from "@/db/schema";
import { profileHandle, SOCIAL_PLATFORM_LABEL, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social";

const EXAMPLE: Record<SocialPlatform, string> = { instagram: "@nome", tiktok: "@nome", youtube: "youtube.com/@canal", x: "@nome" };

export function ProfileForm({ user }: { user: Pick<User, "name" | "headline" | "bio" | "location" | "skills" | "websiteUrl" | "linkedinUrl" | "githubUrl" | "socialLinks"> }) {
  return (
    <ActionForm action={updateProfileAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Nome"><Input name="name" defaultValue={user.name} /></Field>
        <Field name="location" label="Localização"><Input name="location" defaultValue={user.location} /></Field>
      </div>
      <Field name="headline" label="Título" hint="Ex.: Fundadora da Voltaica · Engenheira de energia"><Input name="headline" defaultValue={user.headline} /></Field>
      <Field name="bio" label="Sobre si"><Textarea name="bio" defaultValue={user.bio} /></Field>
      <Field name="skills" label="Competências" hint="Separadas por vírgulas."><Input name="skills" defaultValue={user.skills.join(", ")} /></Field>
      <fieldset className="space-y-4 rounded-2xl bg-mist p-4 ring-1 ring-line sm:p-5">
        <legend className="sr-only">Redes sociais</legend>
        <div>
          <p className="text-[14px] font-semibold">Redes sociais</p>
          <p className="mt-0.5 text-[13px] text-muted">Aparecem no seu perfil e no painel “Seguir”. Indique o @ ou o link do perfil.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((p) => (
            <Field
              key={p}
              name={p}
              label={
                <span className="flex items-center gap-2">
                  <PlatformTile platform={p} size={20} />
                  {SOCIAL_PLATFORM_LABEL[p]}
                </span>
              }
            >
              <Input
                name={p}
                defaultValue={user.socialLinks?.[p] ? (p === "youtube" ? user.socialLinks[p]!.replace("https://www.", "") : profileHandle(p, user.socialLinks[p]!)) : ""}
                placeholder={EXAMPLE[p]}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field name="websiteUrl" label="Website"><Input name="websiteUrl" type="url" defaultValue={user.websiteUrl ?? ""} placeholder="https://" /></Field>
        <Field name="linkedinUrl" label="LinkedIn"><Input name="linkedinUrl" type="url" defaultValue={user.linkedinUrl ?? ""} placeholder="https://" /></Field>
        <Field name="githubUrl" label="GitHub"><Input name="githubUrl" type="url" defaultValue={user.githubUrl ?? ""} placeholder="https://" /></Field>
      </div>
      <div className="flex justify-end border-t border-line pt-5"><SubmitButton pendingLabel="A guardar…">Guardar perfil</SubmitButton></div>
    </ActionForm>
  );
}
