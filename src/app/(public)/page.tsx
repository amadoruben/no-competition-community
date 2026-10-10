import { ArrowRight, Gavel, LineChart, MessagesSquare, PlayCircle, ScrollText, Scale, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { Brand } from "@/components/brand";
import { ChallengeCover, PhaseBadge, phaseTimeline } from "@/components/domain";
import { ButtonLink } from "@/components/ui";
import { demoMode } from "@/server/config";
import { publicOverview } from "@/server/challenges";
import { logger } from "@/server/logger";
import { currentUser, homeFor } from "@/server/session";

const steps = [
  { n: "01", title: "A No Competition lança um desafio", body: "Problema, regras, datas, critérios com pesos e prémios — públicos antes de começar." },
  { n: "02", title: "Os membros inscrevem-se e constroem", body: "Cada participante apresenta o seu projecto, partilha progresso na comunidade e submete antes do prazo." },
  { n: "03", title: "Avaliação com critérios explícitos", body: "Avaliadores atribuídos dão nota por critério e feedback escrito. As notas ficam privadas até à publicação." },
  { n: "04", title: "Resultados e prémios", body: "Vencedores publicados e prémios atribuídos conforme as regras do desafio." },
];

const inside = [
  { icon: MessagesSquare, title: "Comunidade", body: "Anúncios oficiais, conversas, perguntas e progresso de quem está a construir." },
  { icon: PlayCircle, title: "Vídeos exclusivos", body: "Episódios, bastidores e ensinamentos da No Competition, organizados por colecção." },
  { icon: Trophy, title: "Desafios com prémios", body: "Regras e critérios públicos, avaliação independente e resultados transparentes." },
  { icon: Users, title: "Membros", body: "Perfis, conquistas e pessoas com os mesmos interesses para formar equipa." },
];

const principles = [
  { icon: Scale, title: "Critérios antes da competição", body: "Pesos e regras definidos e visíveis antes de qualquer submissão." },
  { icon: LineChart, title: "Mérito não é popularidade", body: "Reacções não dão pontos. O mérito vem apenas de resultados avaliados." },
  { icon: Gavel, title: "Sem promessas vazias", body: "Cada prémio tem condições publicadas; participar não garante prémio." },
  { icon: ScrollText, title: "Decisões com histórico", body: "Publicações, encerramentos e resultados ficam registados." },
];

/** The marketing page must render even when the database is unreachable or not yet configured. */
async function liveData() {
  try {
    const [user, overview] = await Promise.all([currentUser(), publicOverview()]);
    return { user, ...overview };
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("landing.live_data_unavailable", { error });
    return { user: null, challenges: [], stats: null };
  }
}

export default async function Landing() {
  const { user, challenges, stats } = await liveData();
  if (user) redirect(homeFor(user));
  const demo = demoMode();
  // Real numbers only when there is something to show; never a row of zeros.
  const live = stats && stats.members + stats.challenges > 0 ? stats : null;

  return (
    <div className="bg-paper">
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full border-[28px] border-volt/15" aria-hidden />
        <div className="pointer-events-none absolute top-24 right-10 h-[3px] w-[420px] rotate-[-49deg] bg-volt/20" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Brand invert />
            <div className="flex items-center gap-2">
              <Link href="/login" className="flex h-9 items-center rounded-full px-4 text-sm font-medium text-white/80 hover:text-white">
                Entrar
              </Link>
              <ButtonLink href="/register" variant="accent" size="sm" className="hidden sm:inline-flex">
                Criar conta
              </ButtonLink>
            </div>
          </div>
          <div className="grid gap-10 pt-12 pb-16 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:pt-20 lg:pb-24">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] text-white/80">
                <span className="size-1.5 rounded-full bg-volt" /> A comunidade oficial da No Competition
              </p>
              <h1 className="font-display text-[42px] leading-[1.02] font-semibold sm:text-[60px] lg:text-[72px]">
                Construa algo que <span className="text-volt">não tem concorrência.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/70">
                Conteúdos exclusivos, conversas com quem está a construir e desafios com prémios — num só lugar, para quem segue a No Competition.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/register" variant="accent" size="lg">
                  Entrar na comunidade <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href={demo ? "/demo" : "/login"} size="lg" className="bg-white/10 text-white hover:bg-white/20">
                  {demo ? "Ver a demonstração" : "Já sou membro"}
                </ButtonLink>
              </div>
              {live && (
                <p className="mt-6 text-[13px] text-white/60">
                  {live.members} {live.members === 1 ? "membro" : "membros"}
                  {live.challenges > 0 && ` · ${live.challenges} ${live.challenges === 1 ? "desafio" : "desafios"}`}
                </p>
              )}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {inside.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur">
                  <span className="grid size-9 place-items-center rounded-lg bg-volt text-ink">
                    <Icon className="size-[18px]" />
                  </span>
                  <h2 className="mt-3 font-semibold">{title}</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/60">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {challenges.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Desafios abertos</h2>
            <Link href="/register" className="text-sm font-medium underline-offset-4 hover:underline">
              Participar
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

      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Como funcionam os desafios</h2>
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
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Faça parte da comunidade.</h2>
        <p className="mx-auto mt-3 max-w-lg text-ink-2">A conta é gratuita. Alguns conteúdos exclusivos são desbloqueados pela equipa No Competition.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/register" size="lg" variant="accent">
            Criar conta <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="secondary">
            Entrar
          </ButtonLink>
        </div>
      </section>
      <footer className="border-t border-line py-8 text-center text-[12px] text-muted">
        © No Competition
        {demo && " · Os dados apresentados são fictícios, para demonstração."}
      </footer>
    </div>
  );
}
