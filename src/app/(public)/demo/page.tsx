import { ArrowRight, ClipboardCheck, Gauge, Info, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { demoLoginAction } from "@/app/actions";
import { Brand } from "@/components/brand";
import { ButtonLink, Notice } from "@/components/ui";
import { demoMode } from "@/server/config";

export const metadata: Metadata = { title: "Visita guiada" };

const ROLES = {
  investor: { email: "investidor@demo.ncc", label: "Investidora", icon: Gauge },
  evaluator: { email: "avaliador@demo.ncc", label: "Avaliadora", icon: ClipboardCheck },
  member: { email: "membro@demo.ncc", label: "Membro", icon: Rocket },
} as const;

const STEPS: { role: keyof typeof ROLES; next: string; title: string; body: string; show: string[] }[] = [
  {
    role: "investor",
    next: "/admin",
    title: "O painel do investidor",
    body: "Cada desafio com a próxima acção que depende de si, indicadores de submissões e o pipeline de investimento.",
    show: ["Ciclo dos desafios e próxima acção", "Submissões por desafio", "Decisões recentes com autor e data"],
  },
  {
    role: "investor",
    next: "/admin/challenges/new",
    title: "Lançar um desafio",
    body: "Critérios com pesos, prazos, prémios e oportunidades. Fica em rascunho até publicar — com confirmação.",
    show: ["Pesos convertidos em percentagens em tempo real", "Prémio ≠ oportunidade de investimento", "Publicação regista-se no histórico"],
  },
  {
    role: "member",
    next: "/dashboard",
    title: "A experiência do membro",
    body: "O que precisa de atenção, desafios em que participa, projectos e posição nas classificações.",
    show: ["Tarefas pendentes com prazos", "Página pública do projecto com equipa e progresso", "Submeter a Voltaica a “IA para o pequeno comércio”"],
  },
  {
    role: "evaluator",
    next: "/review",
    title: "Avaliação confidencial",
    body: "A avaliadora vê só os trabalhos atribuídos e só as suas notas — nunca as dos colegas nem resultados antes da publicação.",
    show: ["Notas de 0 a 10 por critério, nota ponderada automática", "Feedback escrito para a equipa", "Sem acesso a áreas do investidor"],
  },
  {
    role: "investor",
    next: "/admin",
    title: "Comparar, decidir e publicar",
    body: "Abra “Finanças simples para independentes”: compare projectos, confirme posições com justificação e publique os resultados.",
    show: ["Comparação por critério lado a lado", "Resultados privados até publicar", "Anúncio automático, feedback entregue, pontos de mérito"],
  },
  {
    role: "member",
    next: "/leaderboard",
    title: "Mérito visível, popularidade irrelevante",
    body: "Classificações separadas por participação e mérito, com as regras de pontuação publicadas.",
    show: ["Geral, semanal, mérito, participação, por desafio", "Reacções não dão pontos", "Conquistas no perfil público"],
  },
];

export default async function DemoPage() {
  await connection(); // demo access is a runtime setting, not a build-time one
  const enabled = demoMode();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-[1000px] items-center justify-between px-4 sm:px-6">
        <Brand />
        <ButtonLink href="/login" variant="secondary" size="sm">Entrar</ButtonLink>
      </header>
      <main className="mx-auto max-w-[1000px] px-4 pb-20 sm:px-6">
        <p className="mt-6 text-[13px] font-semibold tracking-wide text-muted uppercase">Visita guiada · ≈ 6 minutos</p>
        <h1 className="mt-2 font-display text-[36px] leading-tight font-semibold sm:text-[48px]">Do desafio publicado ao investimento.</h1>
        <p className="mt-3 max-w-2xl text-[17px] text-ink-2">
          Seis passos que mostram o produto real: as mesmas páginas, regras e base de dados de uma instalação de produção.
        </p>
        <Notice tone="info" className="mt-6 flex gap-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>Todas as pessoas, projectos e valores desta demonstração são <strong>fictícios</strong>. O que criar durante a visita é guardado de verdade nesta instalação de demonstração.</span>
        </Notice>
        {!enabled && (
          <Notice tone="warn" className="mt-4">
            O acesso de demonstração está desligado neste ambiente. Entre com a sua conta.
          </Notice>
        )}
        <ol className="mt-10 space-y-4">
          {STEPS.map((step, i) => {
            const role = ROLES[step.role];
            return (
              <li key={step.title} className="grid gap-5 rounded-2xl bg-surface p-5 ring-1 ring-line sm:grid-cols-[56px_1fr_auto] sm:items-start sm:p-6">
                <span className="tabular font-display text-3xl font-semibold text-faint">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
                    <role.icon className="size-4" /> {role.label}
                  </div>
                  <h2 className="mt-1 font-display text-xl font-semibold">{step.title}</h2>
                  <p className="mt-1 text-[15px] text-ink-2">{step.body}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {step.show.map((s) => (
                      <li key={s} className="rounded-full bg-sunken px-2.5 py-1 text-[12px] text-ink-2">{s}</li>
                    ))}
                  </ul>
                </div>
                {enabled && (
                  <form action={demoLoginAction} className="sm:pt-6">
                    <input type="hidden" name="email" value={role.email} />
                    <input type="hidden" name="next" value={step.next} />
                    <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-ink-2 sm:w-auto">
                      Abrir como {role.label.toLowerCase()} <ArrowRight className="size-4" />
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-10 text-center text-sm text-muted">
          Prefere explorar livremente? <Link href="/login" className="font-medium text-ink underline underline-offset-4">Entrar com uma conta</Link>
        </p>
      </main>
    </div>
  );
}
