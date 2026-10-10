import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  FolderKanban,
  Home,
  Images,
  Lock,
  Megaphone,
  MessageCircle,
  Play,
  Trophy,
  UserRound,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { Art, type ArtName } from "@/components/art";
import { Brand, BrandMark } from "@/components/brand";
import { Carousel } from "@/components/carousel";
import { CoverArt, glyphFor } from "@/components/cover-art";
import { ChallengeCard } from "@/components/domain";
import { FeedPreview, HomePreview, LibraryPreview, ProfilePreview } from "@/components/landing/previews";
import { PlatformTile } from "@/components/social/platform-icon";
import { ButtonLink, cx, fileUrl } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { SOCIAL_PLATFORM_LABEL, SOCIAL_PROFILES } from "@/lib/social";
import { videoSource } from "@/lib/video";
import { publicChallenges } from "@/server/challenges";
import { demoMode } from "@/server/config";
import { publicLibrary } from "@/server/learning";
import { publicSocialPosts } from "@/server/social";
import { logger } from "@/server/logger";
import { currentUser, homeFor } from "@/server/session";

/** The marketing page must render even when the database is unreachable or not yet configured. */
async function liveData() {
  try {
    const [user, challenges, library, social] = await Promise.all([currentUser(), publicChallenges(), publicLibrary(), publicSocialPosts(6)]);
    return { user, challenges, library, social };
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("landing.live_data_unavailable", { error });
    return { user: null, challenges: [], library: [], social: [] };
  }
}

const SECTIONS = [
  { id: "comunidade", label: "Comunidade" },
  { id: "desafios", label: "Desafios" },
  { id: "videos", label: "Vídeos" },
  { id: "membros", label: "Membros" },
  { id: "perguntas", label: "Perguntas" },
];

const AREAS = [
  { icon: Home, title: "Início", body: "Anúncios oficiais, conversas, perguntas e progresso." },
  { icon: Video, title: "Vídeos", body: "Colecções abertas e exclusivas, com progresso guardado." },
  { icon: Zap, title: "Desafios", body: "Regras, critérios e prémios publicados antes de começar." },
  { icon: Users, title: "Membros", body: "Pessoas, projectos e a classificação dos desafios." },
  { icon: UserRound, title: "Perfil", body: "O que está a construir, os seus projectos e conquistas." },
];

const CHALLENGE_STEPS: { art: ArtName; title: string; body: string }[] = [
  { art: "megaphone", title: "A No Competition lança um desafio", body: "Problema, regras, datas, critérios com pesos e prémios — públicos antes de começar." },
  { art: "rocket", title: "Os membros inscrevem-se e constroem", body: "Sozinho ou em equipa: apresenta o projecto, partilha progresso e submete antes do prazo." },
  { art: "scale", title: "Avaliação com critérios explícitos", body: "Avaliadores atribuídos dão nota por critério e feedback escrito, confidencial até à publicação." },
  { art: "trophy", title: "Resultados e prémios", body: "Os vencedores são publicados e os prémios atribuídos conforme as regras do desafio." },
];

const START: { art: ArtName; title: string; body: string }[] = [
  { art: "wave", title: "Crie a sua conta", body: "Nome, email e palavra-passe. Confirme o email e entre." },
  { art: "star", title: "Complete o perfil", body: "Uma frase sobre o que está a construir, competências e fotografia." },
  { art: "speech", title: "Participe no Início", body: "Apresente-se, faça perguntas e acompanhe os anúncios oficiais." },
  { art: "target", title: "Entre num desafio", body: "Leia as regras e os critérios, inscreva-se e submeta antes do prazo." },
];

// Every answer describes how the platform works today; nothing here is a promise.
const FAQ = [
  {
    q: "Quanto custa?",
    a: "Criar conta é gratuito. Algumas colecções de vídeos são exclusivas: o acesso a essas colecções é atribuído pela equipa No Competition.",
  },
  {
    q: "Quem pode participar nos desafios?",
    a: "Qualquer membro com conta, de acordo com as regras de cada desafio. Pode participar sozinho ou em equipa, até ao número de pessoas definido no desafio.",
  },
  {
    q: "Como são avaliados os projectos?",
    a: "Por avaliadores atribuídos pela equipa No Competition, com critérios e pesos publicados antes do início. As notas ficam confidenciais até à publicação dos resultados.",
  },
  {
    q: "Os gostos contam para a classificação?",
    a: "Não. As reacções na comunidade não dão pontos: a classificação vem apenas de resultados avaliados.",
  },
  {
    q: "Os prémios são garantidos?",
    a: "Cada desafio publica os seus prémios e as condições para os receber. Participar não garante prémio.",
  },
  {
    q: "Quem vê o meu perfil e o meu email?",
    a: "O seu perfil é visível para os membros com sessão iniciada; o seu email não aparece no perfil. Pode eliminar a conta a qualquer momento nas definições.",
  },
];

export default async function Landing() {
  const { user, challenges, library, social } = await liveData();
  if (user) redirect(homeFor(user));
  const demo = demoMode();

  return (
    <div className="bg-paper text-ink">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Saltar para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
          <Brand stacked nameClassName="max-[399px]:hidden" />
          <nav aria-label="Nesta página" className="hidden lg:block">
            <ul className="flex items-center gap-0.5 text-[14px] font-medium text-ink-2">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="rounded-full px-3 py-2 transition-colors hover:bg-sunken hover:text-ink">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <ButtonLink href="/login" variant="ghost" className="h-10 px-3.5 text-[14px] text-ink">
              Entrar
            </ButtonLink>
            <ButtonLink href="/register" variant="accent" className="h-10 px-4 text-[14px] font-semibold">
              Criar conta
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id="conteudo">
        {/* Hero */}
        <section className="relative overflow-hidden" aria-labelledby="hero-title">
          <div aria-hidden className="paper-grid absolute inset-0 [mask-image:radial-gradient(90%_70%_at_50%_0%,black,transparent)]" />
          <div aria-hidden className="absolute top-10 -right-40 size-[720px] rounded-full bg-[radial-gradient(closest-side,rgb(195_155_74/0.14),transparent)]" />
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pt-20 lg:pb-24">
            <div>
              <p className="eyebrow flex items-center gap-2.5">
                <span aria-hidden className="h-px w-7 bg-gold" /> Comunidade oficial No Competition
              </p>
              <h1 id="hero-title" className="mt-5 font-display text-[40px] leading-[1.05] font-extrabold text-ink min-[400px]:text-[44px] sm:text-[58px] lg:text-[64px]">
                Construa algo que{" "}
                <span className="underline decoration-gold [text-decoration-skip-ink:none] [text-decoration-thickness:0.075em] [text-underline-offset:0.14em]">não tem concorrência</span>.
              </h1>
              <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
                Uma comunidade para quem constrói negócios em África: conteúdos exclusivos da No Competition, conversas com outros empreendedores e desafios com prémios para pôr ideias à prova.
              </p>
              <div className="mt-8 flex flex-col gap-3 min-[480px]:flex-row">
                <ButtonLink href="/register" variant="accent" size="lg" className="font-semibold">
                  Criar conta gratuita <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href={demo ? "/demo" : "#comunidade"} variant="secondary" size="lg">
                  {demo ? "Ver a demonstração" : "Ver como funciona"}
                </ButtonLink>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-2">
                {["Conta gratuita", "Vídeos exclusivos", "Desafios com prémios"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-4 text-gold-strong" strokeWidth={2.5} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
              <HomePreview />
            </div>
          </div>
        </section>

        {/* The five areas */}
        <section aria-labelledby="areas-title" className="border-y border-line bg-mist">
          <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
            <h2 id="areas-title" className="eyebrow">
              Cinco áreas, um só lugar
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 lg:grid-cols-5">
              {AREAS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex flex-col gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-gold-strong ring-1 ring-line">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block font-display text-[16px] font-bold">{title}</span>
                    <span className="mt-1 block text-[13.5px] leading-relaxed text-muted sm:text-[14px]">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Community feed */}
        <Section id="comunidade">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <Heading id="comunidade" eyebrow="Início · Comunidade" title="Tudo o que acontece na comunidade, num só feed.">
                Anúncios da equipa No Competition, perguntas, progresso de projectos, fotografias e vídeos. Comente, responda, guarde para mais tarde e partilhe com quem precisa de ver.
              </Heading>
              <Features
                items={[
                  { icon: Megaphone, text: "Anúncios oficiais fixados no topo, com o selo da No Competition." },
                  { icon: Images, text: "Até seis fotografias por publicação, ou um vídeo do YouTube ou do Vimeo." },
                  { icon: MessageCircle, text: "Comentários com respostas, para as conversas não se perderem." },
                  { icon: Bookmark, text: "Guardados: o que quer rever fica num só lugar." },
                ]}
              />
            </div>
            <FeedPreview />
          </div>
        </Section>

        {/* Challenges: real, published data only */}
        <Section id="desafios" tone="mist">
          <Heading id="desafios" eyebrow="Desafios" title="Desafios com regras claras e prémios publicados." wide>
            Cada desafio publica o problema, as regras, as datas, os critérios de avaliação com pesos e os prémios antes de começar.
          </Heading>
          <div className="mt-10">
            {challenges.length > 0 ? (
              <Carousel title="Abertos e em breve" headingLevel={3} subtitle="Entre com a sua conta para ver os detalhes e inscrever-se.">
                {challenges.map((c) => (
                  <ChallengeCard key={c.id} c={c} href={`/login?next=/challenges/${c.slug}`} />
                ))}
              </Carousel>
            ) : (
              <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-surface p-6 ring-1 ring-line sm:flex-row sm:items-center">
                <Art name="trophy" size={52} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[17px] font-bold">Ainda não há desafios abertos</h3>
                  <p className="mt-1 text-[14px] text-muted">Os próximos desafios aparecem aqui e no Início da comunidade quando forem publicados.</p>
                </div>
                <ButtonLink href="/register" variant="secondary">
                  Criar conta
                </ButtonLink>
              </div>
            )}
          </div>
          <h3 className="mt-14 font-display text-[20px] font-bold">Como funciona um desafio</h3>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHALLENGE_STEPS.map((s, i) => (
              <li key={s.title} className="rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <Art name={s.art} size={44} />
                  <span className="tabular font-display text-[13px] font-bold text-gold-strong">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <p className="mt-4 text-[15px] font-semibold">{s.title}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Video library: collection titles and sizes only, never the videos */}
        <Section id="videos">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <Heading id="videos" eyebrow="Vídeos" title="O conhecimento da No Competition, organizado por colecções.">
                Episódios, bastidores e ensinamentos, com o seu progresso guardado em cada colecção. Há colecções abertas a todos os membros e colecções exclusivas, desbloqueadas pela equipa No Competition.
              </Heading>
              <ButtonLink href="/register" variant="primary" size="lg" className="mt-8">
                Criar conta para ver <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
            {library.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2" aria-label="Colecções de vídeos">
                {library.map((c) => {
                  const locked = c.accessTier !== "free";
                  return (
                    <li key={c.slug}>
                      <Link href={`/login?next=/videos/${c.slug}`} className="group block h-full overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                        <CoverArt hue={c.coverHue} seed={c.slug} glyph={glyphFor(c.title)} className="aspect-video">
                          <span className="absolute inset-0 grid place-items-center">
                            <span className="grid size-11 place-items-center rounded-full bg-ink/75 text-white backdrop-blur-sm">
                              {locked ? <Lock className="size-5" /> : <Play className="size-5 fill-current" />}
                            </span>
                          </span>
                        </CoverArt>
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium", locked ? "bg-gold-soft text-gold-strong ring-1 ring-gold-line ring-inset" : "bg-sunken text-ink-2")}>
                              {locked && <Lock className="size-3" />} {locked ? "Exclusivo" : "Todos os membros"}
                            </span>
                            <span className="tabular text-[12px] text-muted">
                              {c.videoCount} {c.videoCount === 1 ? "vídeo" : "vídeos"}
                              {c.minutes > 0 && ` · ${c.minutes} min`}
                            </span>
                          </div>
                          <h3 className="mt-2.5 line-clamp-2 text-[15px] leading-snug font-semibold group-hover:underline">{c.title}</h3>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <LibraryPreview />
            )}
          </div>
        </Section>

        {/* Members and profile */}
        <Section id="membros" tone="mist">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div className="lg:order-2">
              <Heading id="membros" eyebrow="Membros e projectos" title="Um perfil que mostra o que está a construir.">
                Apresente-se, mostre os seus projectos e encontre pessoas para formar equipa. Os lugares conquistados em desafios entram no seu perfil quando os resultados são publicados.
              </Heading>
              <Features
                items={[
                  { icon: Users, text: "Directório de membros, com pesquisa por nome, competência ou cidade." },
                  { icon: FolderKanban, text: "Projectos com fase, problema, solução e equipa." },
                  { icon: Trophy, text: "Classificação feita de resultados avaliados — não de gostos." },
                ]}
              />
            </div>
            <ProfilePreview />
          </div>
        </Section>

        {/* Social networks: official profiles only; no counts, no copied posts */}
        <Section id="redes">
          <Heading id="redes" eyebrow="Redes sociais" title="Acompanhe a No Competition também fora da comunidade." wide>
            Siga os perfis oficiais. Nas redes, os conteúdos são públicos; na comunidade, conversa com quem os vê e constrói.
          </Heading>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {SOCIAL_PROFILES.map((p) => (
              <li key={p.url}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-line transition hover:ring-ink/30 hover:shadow-[var(--shadow-pop)]"
                >
                  <PlatformTile platform={p.platform} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[17px] font-bold">{SOCIAL_PLATFORM_LABEL[p.platform]}</span>
                    <span className="block truncate text-[14px] text-muted">@{p.handle}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink">
                    Seguir <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                  <span className="sr-only">(abre noutro separador)</span>
                </a>
              </li>
            ))}
          </ul>
          {social.length > 0 && (
            <>
              <h3 className="mt-14 font-display text-[20px] font-bold">Seleccionadas pela equipa</h3>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {social.map((s) => {
                  const image = s.cover ? fileUrl(s.cover.fileId) : s.youtubeId ? videoSource(s.url)?.thumbnail : null;
                  const label = SOCIAL_PLATFORM_LABEL[s.platform].replace(" (Twitter)", "");
                  return (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line transition hover:shadow-[var(--shadow-pop)]">
                        <span className="relative block bg-mist">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element -- public cover chosen by the team, or the YouTube thumbnail
                            <img src={image} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-square" />
                          ) : (
                            <span className="grid aspect-square place-items-center">
                              <PlatformTile platform={s.platform} size={72} />
                            </span>
                          )}
                          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 py-1 pr-3 pl-1 text-[12px] font-semibold text-white backdrop-blur">
                            <PlatformTile platform={s.platform} size={22} className="!rounded-full" /> {label}
                          </span>
                        </span>
                        <span className="flex flex-1 flex-col p-4">
                          {s.title && <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{s.title}</span>}
                          {s.caption && <span className="mt-1 line-clamp-3 text-[14px] leading-relaxed text-ink-2">{s.caption}</span>}
                          <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-[12.5px] text-muted">
                            <span>
                              {s.creator && `@${s.creator} · `}Partilhado a {fmtDate(s.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1 font-semibold text-ink">
                              Ver original <ArrowUpRight className="size-3.5" />
                            </span>
                          </span>
                        </span>
                        <span className="sr-only">(abre noutro separador)</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>

        {/* How to start */}
        <Section id="comecar" tone="mist">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <Heading id="comecar" eyebrow="Como começar" title="Quatro passos para entrar." />
              <ButtonLink href="/register" variant="accent" size="lg" className="mt-8 font-semibold">
                Criar conta gratuita <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {START.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-line">
                  <span className="relative shrink-0">
                    <Art name={s.art} size={44} />
                    <span className="tabular absolute -right-1.5 -bottom-1 grid size-5 place-items-center rounded-full bg-gold font-display text-[11px] font-bold text-ink ring-2 ring-surface">{i + 1}</span>
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{s.title}</span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-muted">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        {/* FAQ */}
        <Section id="perguntas">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <Heading id="perguntas" eyebrow="Perguntas frequentes" title="O que convém saber antes de entrar." />
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="-mt-1 pb-5 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>

        {/* Final call to action */}
        <section className="px-4 pb-20 sm:px-6" aria-labelledby="cta-title">
          <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-gold-soft px-6 py-14 text-center ring-1 ring-gold-line sm:px-10 sm:py-16">
            <div aria-hidden className="paper-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(70%_80%_at_50%_50%,black,transparent)]" />
            <div className="relative">
              <BrandMark size={52} className="mx-auto" />
              <h2 id="cta-title" className="mx-auto mt-6 max-w-2xl font-display text-[30px] leading-tight font-extrabold sm:text-[40px]">
                Comece hoje. A conta é gratuita.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[16px] text-ink-2">Entre na comunidade da No Competition e construa com quem também está a construir.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 min-[480px]:flex-row">
                <ButtonLink href="/register" variant="accent" size="lg" className="font-semibold">
                  Criar conta <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg">
                  Já tenho conta
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-mist">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Brand stacked />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">A comunidade da No Competition para quem constrói negócios em África.</p>
          </div>
          <FooterLinks title="Conta" links={[["/login", "Entrar"], ["/register", "Criar conta"], ["/forgot-password", "Recuperar acesso"]]} />
          <FooterLinks title="Nesta página" links={SECTIONS.map((s) => [`#${s.id}`, s.label] as [string, string])} />
          <FooterLinks title="Redes sociais" links={SOCIAL_PROFILES.map((p) => [p.url, SOCIAL_PLATFORM_LABEL[p.platform]] as [string, string])} external />
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-[1200px] px-4 py-5 text-[12.5px] text-muted sm:px-6">
            © No Competition
            {demo && " · Ambiente de demonstração: os desafios e colecções apresentados podem ser fictícios."}
          </p>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, tone, children }: { id: string; tone?: "mist"; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cx("scroll-mt-16", tone === "mist" && "border-y border-line bg-mist")}>
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">{children}</div>
    </section>
  );
}

function Heading({ id, eyebrow, title, wide, children }: { id: string; eyebrow: string; title: string; wide?: boolean; children?: ReactNode }) {
  return (
    <div className={wide ? "max-w-3xl" : "max-w-xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-3 font-display text-[30px] leading-[1.12] font-bold text-ink sm:text-[40px]">
        {title}
      </h2>
      {children && <p className="mt-4 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">{children}</p>}
    </div>
  );
}

function Features({ items }: { items: { icon: LucideIcon; text: string }[] }) {
  return (
    <ul className="mt-8 space-y-4">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex gap-3.5 text-[15px] leading-relaxed text-ink-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-strong ring-1 ring-gold-line">
            <Icon className="size-4" />
          </span>
          <span className="pt-1">{text}</span>
        </li>
      ))}
    </ul>
  );
}

function FooterLinks({ title, links, external }: { title: string; links: [string, string][]; external?: boolean }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
      <ul className="mt-3 space-y-2 text-[14px] text-muted">
        {links.map(([href, label]) => (
          <li key={href}>
            {external ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                {label} <ArrowUpRight className="size-3.5" />
              </a>
            ) : href.startsWith("#") ? (
              <a href={href} className="hover:text-ink">
                {label}
              </a>
            ) : (
              <Link href={href} className="hover:text-ink">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
