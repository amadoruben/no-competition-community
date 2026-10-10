"use client";

import { useState } from "react";
import type { Project } from "@/db/schema";
import { STAGE_LABEL } from "@/lib/labels";
import type { ActionState } from "@/lib/action-state";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "./form";
import { ProjectLogo } from "./ui";

const HUES = [85, 150, 200, 230, 260, 300, 330, 20, 45, 125];

export function ProjectForm({
  action,
  project,
  categories,
  returnTo,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  project?: Project;
  categories: string[];
  returnTo?: string;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [hue, setHue] = useState(project?.logoHue ?? 150);
  return (
    <ActionForm action={action} className="space-y-8">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <input type="hidden" name="logoHue" value={hue} />
      <section className="space-y-5">
        <div className="flex items-center gap-4">
          <ProjectLogo name={name || "?"} hue={hue} size={64} />
          <div>
            <div className="text-[13px] font-medium">Cor da identidade</div>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor do logótipo">
              {HUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={h === hue}
                  aria-label={`Cor ${h}`}
                  onClick={() => setHue(h)}
                  className="size-7 rounded-full ring-offset-2 aria-checked:ring-2 aria-checked:ring-ink"
                  style={{ background: `hsl(${h} 70% 45%)` }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="name" label="Nome do projecto">
            <Input name="name" defaultValue={project?.name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Voltaica" />
          </Field>
          <Field name="category" label="Categoria">
            <Input name="category" list="categories" defaultValue={project?.category} placeholder="Ex.: Energia e clima" />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field name="tagline" label="Frase de apresentação" hint="Uma frase que explique o que faz e para quem.">
          <Input name="tagline" defaultValue={project?.tagline} maxLength={140} />
        </Field>
        <Field name="stage" label="Fase de desenvolvimento">
          <Select name="stage" defaultValue={project?.stage ?? "idea"}>
            {Object.entries(STAGE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="space-y-5 border-t border-line pt-6">
        <h2 className="font-display text-lg font-semibold">Problema e solução</h2>
        <Field name="problem" label="Problema" hint="Quem sofre, quanto custa, porque é que as alternativas falham.">
          <Textarea name="problem" defaultValue={project?.problem} />
        </Field>
        <Field name="solution" label="Solução">
          <Textarea name="solution" defaultValue={project?.solution} />
        </Field>
        <Field name="description" label="Sobre o projecto" hint="Estado actual, validação, métricas.">
          <Textarea name="description" rows={5} defaultValue={project?.description} />
        </Field>
      </section>

      <section className="space-y-5 border-t border-line pt-6">
        <h2 className="font-display text-lg font-semibold">Ligações</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field name="websiteUrl" label="Website">
            <Input name="websiteUrl" type="url" placeholder="https://" defaultValue={project?.websiteUrl ?? ""} />
          </Field>
          <Field name="demoUrl" label="Demonstração">
            <Input name="demoUrl" type="url" placeholder="https://" defaultValue={project?.demoUrl ?? ""} />
          </Field>
          <Field name="repoUrl" label="Repositório">
            <Input name="repoUrl" type="url" placeholder="https://" defaultValue={project?.repoUrl ?? ""} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end border-t border-line pt-5">
        <SubmitButton variant="accent" size="lg" pendingLabel="A guardar…">
          {project ? "Guardar alterações" : "Criar projecto"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
