"use client";

import { Trash2 } from "lucide-react";
import { addVideoAction, collectionAccessAction, createCollectionAction, deleteCollectionAction, deleteVideoAction } from "@/app/actions";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { ConfirmSubmit } from "@/components/overlay";
import { buttonClass } from "@/components/ui";

const ACCESS_OPTIONS = (
  <>
    <option value="free">Todos os membros</option>
    <option value="full">Só membros com acesso completo</option>
  </>
);

export function NewCollectionForm() {
  return (
    <ActionForm action={createCollectionAction} resetOnSuccess className="space-y-3">
      <Field name="title" id="c-title" label="Nome da colecção">
        <Input id="c-title" name="title" required minLength={3} maxLength={100} placeholder="Ex.: Bastidores" />
      </Field>
      <Field name="description" id="c-description" label="Descrição">
        <Textarea id="c-description" name="description" required minLength={3} maxLength={400} rows={2} placeholder="O que os membros vão encontrar." />
      </Field>
      <Field name="accessTier" id="c-access" label="Quem pode ver">
        <Select id="c-access" name="accessTier" defaultValue="free">{ACCESS_OPTIONS}</Select>
      </Field>
      <SubmitButton pendingLabel="A criar…">Criar colecção</SubmitButton>
    </ActionForm>
  );
}

export function NewVideoForm({ collections }: { collections: { id: string; title: string }[] }) {
  return (
    <ActionForm action={addVideoAction} resetOnSuccess className="space-y-3">
      <Field name="courseId" id="v-course" label="Colecção">
        <Select id="v-course" name="courseId" required defaultValue={collections[0]?.id}>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </Select>
      </Field>
      <Field name="title" id="v-title" label="Título do vídeo">
        <Input id="v-title" name="title" required minLength={3} maxLength={140} />
      </Field>
      <Field name="videoUrl" id="v-url" label="Link do vídeo" hint="YouTube (público ou não listado), Vimeo, ou ficheiro https .mp4/.webm.">
        <Input id="v-url" name="videoUrl" type="url" required placeholder="https://youtu.be/…" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="durationMin" id="v-min" label="Duração (min)">
          <Input id="v-min" name="durationMin" type="number" min={1} max={600} required defaultValue={10} />
        </Field>
        <Field name="section" id="v-section" label="Secção (opcional)" hint="Agrupa vídeos dentro da colecção.">
          <Input id="v-section" name="section" maxLength={80} placeholder="Vídeos" />
        </Field>
      </div>
      <Field name="content" id="v-content" label="Descrição ou notas (opcional)">
        <Textarea id="v-content" name="content" rows={3} maxLength={5000} />
      </Field>
      <SubmitButton variant="accent" pendingLabel="A publicar…">Publicar vídeo</SubmitButton>
    </ActionForm>
  );
}

export function AccessSelect({ courseId, tier }: { courseId: string; tier: string }) {
  return (
    <ActionForm action={collectionAccessAction.bind(null, courseId)} showMessages={false} className="flex items-center gap-2">
      <Select id={`access-${courseId}`} name="accessTier" defaultValue={tier} aria-label="Quem pode ver" className="h-8 w-auto text-[13px]">{ACCESS_OPTIONS}</Select>
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">Guardar</SubmitButton>
    </ActionForm>
  );
}

export function DeleteCollection({ courseId, title, count }: { courseId: string; title: string; count: number }) {
  return (
    <ActionForm action={deleteCollectionAction.bind(null, courseId)} showMessages={false}>
      <ConfirmSubmit
        title={`Remover “${title}”?`}
        description={count ? `Os ${count} vídeos e o progresso dos membros nesta colecção são removidos. Os vídeos no YouTube/Vimeo não são afectados.` : "A colecção está vazia."}
        confirmLabel="Remover"
        tone="danger"
        className={buttonClass("ghost", "sm")}
        aria-label={`Remover colecção ${title}`}
      >
        <Trash2 className="size-4" />
      </ConfirmSubmit>
    </ActionForm>
  );
}

export function DeleteVideo({ lessonId, title }: { lessonId: string; title: string }) {
  return (
    <ActionForm action={deleteVideoAction.bind(null, lessonId)} showMessages={false}>
      <ConfirmSubmit title={`Remover “${title}”?`} description="O vídeo sai da biblioteca. O original no YouTube/Vimeo não é afectado." confirmLabel="Remover" tone="danger" className={buttonClass("ghost", "sm")} aria-label={`Remover vídeo ${title}`}>
        <Trash2 className="size-4" />
      </ConfirmSubmit>
    </ActionForm>
  );
}
