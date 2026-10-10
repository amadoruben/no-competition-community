"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { PRIZE_KIND_LABEL } from "@/lib/labels";
import { ActionForm, controlClass, Field, Input, SubmitButton, Textarea, useFormState } from "./form";
import { ChallengeCover, cx } from "./ui";

type Crit = { id?: string; name: string; description: string; weight: number };
type Prize = { id?: string; rank: number | null; title: string; description: string; value: string; kind: "prize" | "investment" | "recognition" };

export interface ChallengeDraft {
  title: string;
  tagline: string;
  description: string;
  category: string;
  objectives: string[];
  rules: string[];
  submissionInstructions: string;
  startsAt: Date;
  submissionDeadline: Date;
  resultsDate: Date;
  maxTeamSize: number;
  placementPoints: number[];
  participantsVisible: boolean;
  coverHue: number;
  criteria: Crit[];
  prizes: Prize[];
}

const toLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const HUES = [85, 140, 200, 230, 260, 300, 330, 20, 45];

export function ChallengeEditor({
  action,
  initial,
  criteriaLocked,
  submitLabel,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  initial: ChallengeDraft;
  criteriaLocked?: boolean;
  submitLabel: string;
}) {
  const [v, setV] = useState({
    ...initial,
    startsAt: toLocal(initial.startsAt),
    submissionDeadline: toLocal(initial.submissionDeadline),
    resultsDate: toLocal(initial.resultsDate),
    objectivesText: initial.objectives.join("\n"),
    rulesText: initial.rules.join("\n"),
    pointsText: initial.placementPoints.join(", "),
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const totalWeight = v.criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0) || 1;

  const toIso = (s: string) => (s ? new Date(s).toISOString() : "");
  const payload = JSON.stringify({
    title: v.title,
    tagline: v.tagline,
    description: v.description,
    category: v.category,
    objectives: v.objectivesText.split("\n").map((s) => s.trim()).filter(Boolean),
    rules: v.rulesText.split("\n").map((s) => s.trim()).filter(Boolean),
    submissionInstructions: v.submissionInstructions,
    startsAt: toIso(v.startsAt),
    submissionDeadline: toIso(v.submissionDeadline),
    resultsDate: toIso(v.resultsDate),
    maxTeamSize: v.maxTeamSize,
    placementPoints: v.pointsText.split(/[,;\s]+/).filter(Boolean).map(Number),
    participantsVisible: v.participantsVisible,
    coverHue: v.coverHue,
    criteria: v.criteria,
    prizes: v.prizes,
  });

  const ctl = (k: "title" | "tagline" | "category" | "submissionInstructions" | "description") => ({
    name: k,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value),
  });

  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      <ChallengeCover hue={v.coverHue} className="rounded-2xl p-6 text-white">
        <div className="text-[12px] text-white/70">{v.category || "Categoria"}</div>
        <div className="mt-1 font-display text-2xl font-semibold">{v.title || "Título do desafio"}</div>
        <div className="mt-1 max-w-xl text-sm text-white/80">{v.tagline || "Resumo numa frase."}</div>
        <div className="mt-4 flex gap-1.5" role="radiogroup" aria-label="Cor da capa">
          {HUES.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={h === v.coverHue} aria-label={`Cor ${h}`} onClick={() => set("coverHue", h)} className="size-6 rounded-full ring-2 ring-white/30 aria-checked:ring-white" style={{ background: `hsl(${h} 70% 45%)` }} />
          ))}
        </div>
      </ChallengeCover>

      <Section title="Essencial">
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field name="title" label="Título"><Input {...ctl("title")} /></Field>
          <Field name="category" label="Categoria"><Input {...ctl("category")} placeholder="Ex.: Fintech" /></Field>
        </div>
        <Field name="tagline" label="Resumo" hint="Uma frase com o resultado esperado."><Input {...ctl("tagline")} /></Field>
        <Field name="description" label="Descrição" hint="Contexto, porque importa, o que procura."><Textarea {...ctl("description")} rows={6} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="objectives" label="Objectivos" hint="Um por linha."><Textarea name="objectives" rows={4} value={v.objectivesText} onChange={(e) => set("objectivesText", e.target.value)} /></Field>
          <Field name="rules" label="Regras de participação" hint="Uma por linha."><Textarea name="rules" rows={4} value={v.rulesText} onChange={(e) => set("rulesText", e.target.value)} /></Field>
        </div>
        <Field name="submissionInstructions" label="Instruções de submissão"><Textarea {...ctl("submissionInstructions")} rows={3} /></Field>
      </Section>

      <Section title="Datas e participação">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field name="startsAt" label="Abertura"><Input type="datetime-local" name="startsAt" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
          <Field name="submissionDeadline" label="Prazo de submissão"><Input type="datetime-local" name="submissionDeadline" value={v.submissionDeadline} onChange={(e) => set("submissionDeadline", e.target.value)} /></Field>
          <Field name="resultsDate" label="Resultados previstos"><Input type="datetime-local" name="resultsDate" value={v.resultsDate} onChange={(e) => set("resultsDate", e.target.value)} /></Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field name="maxTeamSize" label="Tamanho máximo da equipa"><Input type="number" min={1} max={20} name="maxTeamSize" value={v.maxTeamSize} onChange={(e) => set("maxTeamSize", Number(e.target.value))} /></Field>
          <Field name="placementPoints" label="Pontos de classificação" hint="Por posição: 1.º, 2.º, 3.º…"><Input name="placementPoints" value={v.pointsText} onChange={(e) => set("pointsText", e.target.value)} /></Field>
          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium">Visibilidade</span>
            <label className="flex h-11 items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={v.participantsVisible} onChange={(e) => set("participantsVisible", e.target.checked)} className="size-4 accent-ink" />
              Participantes visíveis aos membros
            </label>
          </div>
        </div>
      </Section>

      <Section title="Critérios de avaliação" subtitle={criteriaLocked ? "Já existem avaliações: pode ajustar nomes, descrições e pesos, mas não adicionar ou remover critérios." : "Cada avaliador atribui 0–10 por critério. Os pesos são relativos."}>
        <FieldError name="criteria" />
        <div className="space-y-3">
          {v.criteria.map((c, i) => (
            <div key={c.id ?? `new-${i}`} className="grid gap-3 rounded-xl bg-sunken/50 p-3 sm:grid-cols-[1fr_1.4fr_90px_70px_auto] sm:items-center">
              <input aria-label="Nome do critério" className={cx(controlClass, "h-10")} value={c.name} placeholder="Nome" onChange={(e) => set("criteria", v.criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input aria-label="Descrição do critério" className={cx(controlClass, "h-10")} value={c.description} placeholder="O que se avalia" onChange={(e) => set("criteria", v.criteria.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <label className="flex items-center gap-2 text-[13px] text-muted">
                Peso
                <input aria-label="Peso" type="number" min={1} max={10} className={cx(controlClass, "h-10 w-16 px-2")} value={c.weight} onChange={(e) => set("criteria", v.criteria.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} />
              </label>
              <span className="tabular text-right font-mono text-sm font-semibold">{Math.round(((Number(c.weight) || 0) / totalWeight) * 100)}%</span>
              <button type="button" disabled={criteriaLocked || v.criteria.length === 1} onClick={() => set("criteria", v.criteria.filter((_, j) => j !== i))} aria-label="Remover critério" className="grid size-9 place-items-center rounded-full text-muted hover:bg-bad-soft hover:text-bad disabled:opacity-30">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {!criteriaLocked && v.criteria.length < 10 && (
          <button type="button" onClick={() => set("criteria", [...v.criteria, { name: "", description: "", weight: 1 }])} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
            <Plus className="size-4" /> Adicionar critério
          </button>
        )}
      </Section>

      <Section title="Prémios e oportunidades" subtitle="Vencer dá direito ao prémio. Oportunidades de investimento são processos separados.">
        <div className="space-y-3">
          {v.prizes.map((p, i) => {
            const upd = (patch: Partial<Prize>) => set("prizes", v.prizes.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={p.id ?? `new-${i}`} className="grid gap-3 rounded-xl bg-sunken/50 p-3 sm:grid-cols-[110px_1fr_1fr_150px_auto] sm:items-center">
                <select aria-label="Posição" className={cx(controlClass, "h-10")} value={p.rank ?? ""} onChange={(e) => upd({ rank: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem posição</option>
                  {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r}.º lugar</option>)}
                </select>
                <input aria-label="Título do prémio" className={cx(controlClass, "h-10")} value={p.title} placeholder="Título" onChange={(e) => upd({ title: e.target.value })} />
                <input aria-label="Valor" className={cx(controlClass, "h-10")} value={p.value} placeholder="Valor (ex.: €10.000)" onChange={(e) => upd({ value: e.target.value })} />
                <select aria-label="Tipo" className={cx(controlClass, "h-10")} value={p.kind} onChange={(e) => upd({ kind: e.target.value as Prize["kind"] })}>
                  {Object.entries(PRIZE_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button type="button" onClick={() => set("prizes", v.prizes.filter((_, j) => j !== i))} aria-label="Remover prémio" className="grid size-9 place-items-center rounded-full text-muted hover:bg-bad-soft hover:text-bad">
                  <Trash2 className="size-4" />
                </button>
                <input aria-label="Descrição do prémio" className={cx(controlClass, "h-10 sm:col-span-4")} value={p.description} placeholder="Descrição (opcional)" onChange={(e) => upd({ description: e.target.value })} />
              </div>
            );
          })}
        </div>
        {v.prizes.length < 10 && (
          <button type="button" onClick={() => set("prizes", [...v.prizes, { rank: null, title: "", description: "", value: "", kind: "prize" }])} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
            <Plus className="size-4" /> Adicionar prémio
          </button>
        )}
      </Section>

      <ErrorSummary />
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
        <SubmitButton variant="accent" size="lg" pendingLabel="A guardar…">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line pt-6 first-of-type:border-0">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FieldError({ name }: { name: string }) {
  const { state } = useFormState();
  const e = state?.fieldErrors?.[name];
  return e ? <p className="text-[13px] text-bad">{e}</p> : null;
}

/** Nested-field errors (criteria.0.name…) summarised in plain language. */
function ErrorSummary() {
  const { state } = useFormState();
  const nested = Object.entries(state?.fieldErrors ?? {}).filter(([k]) => k.includes("."));
  if (!nested.length) return null;
  return (
    <ul className="space-y-1 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
      {nested.map(([k, m]) => {
        const [group, idx] = k.split(".");
        return <li key={k}>{group === "criteria" ? `Critério ${Number(idx) + 1}` : group === "prizes" ? `Prémio ${Number(idx) + 1}` : group}: {m}</li>;
      })}
    </ul>
  );
}
