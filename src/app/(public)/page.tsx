import { ArrowRight, Check, Gavel, LineChart, ScrollText, Scale } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ChallengeCover, PhaseBadge, phaseTimeline } from "@/components/domain";
import { ButtonLink } from "@/components/ui";
import { publicOverview } from "@/server/challenges";
import { currentUser, homeFor } from "@/server/session";

const steps = [
  { n: "01", title: "O investidor lança um desafio", body: "Problema, regras, critérios com pesos e prémios — tudo público desde o primeiro dia." },
  { n: "02", title: "Equipas constroem e submetem", body: "Cada membro apresenta o seu projecto, partilha progresso e submete antes do prazo." },
  { n: "03", title: "Avaliação com critérios explícitos", body: "Avaliadores atribuídos dão nota por critério e feedback. A nota final é uma média ponderada." },
  { n: "04", title: "Resultados e oportunidades", body: "Vencedores publicados, rankings actualizados. O investimento é uma decisão separada." },
];

const principles = [
  { icon: Scale, title: "Critérios antes da competição", body: "Pesos e regras definidos e visíveis antes de qualquer submissão." },
  { icon: LineChart, title: "Mérito não é popularidade", body: "Reacções não dão pontos. O mérito vem apenas de resultados avaliados." },
  { icon: Gavel, title: "Vencer não é investimento", body: "Prémio, vitória e financiamento são registos distintos, com processos próprios." },
  { icon: ScrollText, title: "Decisões com histórico", body: "Publicações, encerramentos e resultados ficam registados e auditáveis." },
];

export default async function Landing() {
  const user = await currentUser();
  if (user) redirect(homeFor(user));
  const { challenges, stats } = await publicOverview();

  return (
    <div className="bg-paper">
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full border-[28px] border-volt/15" aria-hidden />
        <div className="pointer-events-none absolute top-24 right-10 h-[3px] w-[420px] rotate-[-49deg] bg-volt/20" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Brand invert />
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden h-9 items-center rounded-full px-4 text-sm font-medium text-white/80 hover:text-white sm:flex">
                Entrar
              </Link>
              <ButtonLink href="/register" variant="accent" size="sm">
                Criar conta
              </ButtonLink>
            </div>
          </div>
          <div className="grid gap-10 pt-14 pb-20 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:pt-24 lg:pb-28">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] text-white/80">
                <span className="size-1.5 rounded-full bg-volt" /> {stats.challenges} desafios · {stats.projects} projectos na comunidade
              </p>
              <h1 className="font-display text-[44px] leading-[1.02] font-semibold sm:text-[64px] lg:text-[76px]">
                Construa algo que <span className="text-volt">não tem concorrência.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/70">
                A comunidade onde um investidor lança desafios reais e as melhores equipas constroem, submetem e são avaliadas com critérios públicos.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/login" variant="accent" size="lg">
                  Explorar a demonstração <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/register" size="lg" className="bg-white/10 text-white hover:bg-white/20">
                  Juntar-me à comunidade
                </ButtonLink>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
              {[
                ["Desafios", stats.challenges],
                ["Projectos", stats.projects],
                ["Membros", stats.members],
                ["Submissões", stats.submissions],
              ].map(([k, v]) => (
                <div key={k} className="bg-ink/60 p-5 backdrop-blur">
                  <dt className="text-[12px] tracking-wide text-white/50 uppercase">{k}</dt>
                  <dd className="tabular mt-1 font-display text-4xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Como funciona</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              <div className="font-mono text-[13px] text-muted">{s.n}</div>
              <h3 className="mt-3 text-[16px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {challenges.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Desafios abertos</h2>
            <Link href="/login" className="text-sm font-medium underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {challenges.map((c) => (
              <Link key={c.id} href="/login" className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-pop)]">
                <ChallengeCover hue={c.coverHue} className="flex h-36 flex-col justify-between p-4">
                  <div className="flex justify-between">
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white">{c.category}</span>
                    <PhaseBadge phase={c.phase} />
                  </div>
                  {c.topPrize && <span className="font-display text-2xl font-bold text-white">{c.topPrize.value}</span>}
                </ChallengeCover>
                <div className="p-4">
                  <h3 className="font-display text-lg font-semibold group-hover:underline">{c.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-2">{c.tagline}</p>
                  <p className="mt-3 text-[13px] font-medium">{phaseTimeline(c, c.phase)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold">Regras claras, decisões defensáveis.</h2>
            <p className="mt-3 text-ink-2">Uma competição só é justa se os critérios forem conhecidos e as decisões ficarem registadas.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {principles.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-volt-soft ring-1 ring-volt-strong/40">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-16 text-center sm:px-6">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Veja a plataforma por dentro.</h2>
        <p className="mx-auto mt-3 max-w-lg text-ink-2">Entre com uma conta de demonstração como investidora, avaliadora ou membro.</p>
        <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-2">
          {["Criar e publicar desafios", "Avaliar e comparar projectos", "Publicar resultados"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="size-4 text-ok" /> {t}
            </li>
          ))}
        </ul>
        <ButtonLink href="/login" size="lg" className="mt-8">
          Entrar na demonstração <ArrowRight className="size-4" />
        </ButtonLink>
      </section>
      <footer className="border-t border-line py-8 text-center text-[12px] text-faint">
        © No Competition Community · Os dados apresentados são fictícios, para demonstração.
      </footer>
    </div>
  );
}
