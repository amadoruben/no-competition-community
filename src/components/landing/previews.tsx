import {
  BadgeCheck,
  Bookmark,
  FolderKanban,
  Heart,
  ImageIcon,
  Lock,
  Megaphone,
  MessageCircle,
  Pin,
  Play,
  Send,
  Trophy,
  UserRound,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../brand";
import { CommunityBanner, CoverArt, glyphFor } from "../cover-art";
import { cx } from "../ui";

/*
 * Static illustrations of the app for the public landing page, drawn with the
 * app's own tokens, mark and cover art. They are pictures, not interfaces:
 * one accessible description, nothing focusable, and a visible caption saying
 * the content is an example. Nothing here names a real member, invents a
 * number, a prize or a result, or is attributed to the founder.
 */

export function Illustration({ label, caption = "Ilustração da app · conteúdo de exemplo", className, frameClassName, children }: { label: string; caption?: string; className?: string; frameClassName?: string; children: ReactNode }) {
  return (
    <figure className={cx("min-w-0", className)}>
      <div role="img" aria-label={label} className={cx("overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-float)] ring-1 ring-line", frameClassName)}>
        <div aria-hidden className="flex h-8 items-center gap-1.5 border-b border-line bg-mist px-4">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </div>
        <div aria-hidden className="pointer-events-none select-none">
          {children}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-muted">{caption}</figcaption>
    </figure>
  );
}

const AREAS = ["Início", "Vídeos", "Desafios", "Membros", "Perfil"];

function TopBar({ active = 0 }: { active?: number }) {
  return (
    <div className="flex h-11 items-center gap-3 border-b border-line bg-surface px-3.5">
      <BrandMark size={22} />
      <div className="flex h-full min-w-0 items-stretch gap-0.5 text-[11.5px] font-medium">
        {AREAS.map((label, i) => (
          <span
            key={label}
            className={cx(
              "relative items-center px-2",
              i === active ? "flex text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-gold" : "text-muted",
              i !== active && (i > 2 ? "hidden sm:flex" : "flex"),
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <span className="ml-auto grid size-6 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-strong ring-1 ring-gold-line">
        <UserRound className="size-3.5" />
      </span>
    </div>
  );
}

/** Generic person: examples never show a real member's name or face. */
function Someone({ size = 28 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-sunken text-muted ring-1 ring-line" style={{ width: size, height: size }}>
      <UserRound style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

function Actions() {
  return (
    <div className="mt-2.5 flex items-center gap-3.5 text-ink-2">
      <Heart className="size-[15px]" />
      <MessageCircle className="size-[15px]" />
      <Send className="size-[15px]" />
      <Bookmark className="ml-auto size-[15px]" />
    </div>
  );
}

function OfficialPost({ text }: { text: string }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-gold-line">
      <div className="flex items-center gap-1.5 border-b border-gold-line bg-gold-soft px-3 py-1.5 text-[10.5px] font-semibold text-gold-strong">
        <Megaphone className="size-3" /> Anúncio oficial
        <span className="ml-auto inline-flex items-center gap-1 font-medium">
          <Pin className="size-3" /> Fixado
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <BrandMark size={28} />
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-1 text-[12px] font-semibold text-ink">
              No Competition <BadgeCheck className="size-3.5 fill-ink text-gold" />
            </p>
            <p className="text-[10.5px] text-muted">Equipa No Competition</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{text}</p>
        <Actions />
      </div>
    </div>
  );
}

function MemberPost({ kind, title, text, children }: { kind: "Pergunta" | "Progresso"; title?: string; text: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <Someone />
        <div className="min-w-0 leading-tight">
          <p className="text-[12px] font-semibold text-ink">Membro da comunidade</p>
          <p className="text-[10.5px]">
            <span className="text-muted">Exemplo · </span>
            <span className={cx("font-medium", kind === "Pergunta" ? "text-info" : "text-ok")}>{kind}</span>
          </p>
        </div>
      </div>
      {title && <p className="mt-2 text-[12.5px] font-semibold text-ink">{title}</p>}
      <p className={cx("text-[12px] leading-relaxed text-ink-2", title ? "mt-0.5" : "mt-2")}>{text}</p>
      {children}
      <Actions />
    </div>
  );
}

function ChallengeTile({ hue, seed, theme, category, title, phase, open }: { hue: number; seed: string; theme: string; category: string; title: string; phase: string; open?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
      <CoverArt hue={hue} seed={seed} glyph={glyphFor(theme)} className="aspect-[16/9]">
        <div className="flex h-full items-start justify-between gap-1 p-1.5">
          <span className="truncate rounded-full bg-black/35 px-1.5 py-0.5 text-[9.5px] font-medium text-white">{category}</span>
          <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold", open ? "bg-gold-soft text-gold-strong" : "bg-info-soft text-info")}>
            {open && <span className="size-1 rounded-full bg-current" />}
            {phase}
          </span>
        </div>
      </CoverArt>
      <div className="p-2 leading-tight">
        <p className="truncate text-[11px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted">Regras, critérios e prémios</p>
      </div>
    </div>
  );
}

/** A photo in an illustration: a generic picture (sun and hills), never a stock image. */
function PhotoArt({ hue, className }: { hue: number; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden", className)} style={{ background: `linear-gradient(165deg, hsl(${hue} 60% 90%), hsl(${hue + 22} 42% 74%))` }}>
      <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
        <circle cx="116" cy="32" r="11" fill="white" opacity="0.75" />
        <path d="M0 100V68Q30 46 58 64T112 58Q138 50 160 62V100Z" fill={`hsl(${hue + 18} 34% 56%)`} opacity="0.5" />
        <path d="M0 100V82Q40 64 80 78T160 74V100Z" fill={`hsl(${hue + 28} 30% 40%)`} opacity="0.5" />
      </svg>
    </div>
  );
}

/** Hero: the member home, with the community header, a pinned announcement and challenges. */
export function HomePreview() {
  return (
    <Illustration label="Ilustração do Início da comunidade: o cabeçalho da comunidade, um anúncio oficial fixado e os desafios em destaque.">
      <TopBar />
      <div className="space-y-3 bg-mist p-3 sm:p-4">
        <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-line">
          <CommunityBanner className="h-14 sm:h-16" />
          <div className="flex items-end gap-2.5 px-3 pb-3">
            <span className="relative -mt-5 block shrink-0 rounded-[12px] bg-surface p-[3px]">
              <BrandMark size={40} className="rounded-[10px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-display text-[13px] font-bold text-ink">No Competition Community</p>
              <p className="truncate text-[10.5px] text-muted">Comunidade oficial · Negócios em África</p>
            </div>
            <span className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-[10.5px] font-semibold text-ink">Publicar</span>
          </div>
        </div>
        <OfficialPost text="Bem-vindo à comunidade. Apresente-se no feed, veja os vídeos novos e acompanhe os desafios abertos." />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-[12px] font-bold text-ink">Desafios em destaque</p>
            <span className="text-[10.5px] font-medium text-gold-strong">Ver todos</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ChallengeTile hue={152} seed="hero-a" theme="comércio" category="Comércio" title="Desafio de exemplo" phase="Inscrições abertas" open />
            <ChallengeTile hue={262} seed="hero-b" theme="energia" category="Energia" title="Próximo desafio" phase="Em breve" />
          </div>
        </div>
      </div>
    </Illustration>
  );
}

/** The feed: composer, filters, a question and a progress update with photos. */
export function FeedPreview() {
  return (
    <Illustration label="Ilustração do feed: caixa para publicar com fotografias e vídeo, filtros, uma pergunta e uma actualização de progresso com fotografias.">
      <div className="space-y-3 bg-mist p-3 sm:p-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5 ring-1 ring-line">
          <Someone size={30} />
          <span className="min-w-0 flex-1 truncate rounded-full bg-sunken px-3 py-1.5 text-[11.5px] text-muted">Escreva algo…</span>
          <ImageIcon className="size-4 shrink-0 text-ink-2" />
          <Video className="size-4 shrink-0 text-ink-2" />
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {["Tudo", "Oficiais", "Conversas", "Perguntas", "Progresso"].map((f, i) => (
            <span
              key={f}
              className={cx("shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium ring-1", i === 0 ? "bg-gold-soft text-ink ring-gold" : "bg-surface text-ink-2 ring-line")}
            >
              {f}
            </span>
          ))}
        </div>
        <MemberPost kind="Pergunta" title="Como validaram o preço antes de lançar?" text="Estou a preparar o lançamento e gostava de ouvir quem já passou por esta fase." />
        <MemberPost kind="Progresso" text="Primeira versão do protótipo pronta. Partilho as fotografias e o que aprendi nos testes.">
          <div className="relative mt-2.5 overflow-hidden rounded-lg">
            <PhotoArt hue={32} className="aspect-[16/10]" />
            <span className="tabular absolute top-2 right-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9.5px] font-medium text-white">1/3</span>
          </div>
          <div className="mt-2 flex justify-center gap-1">
            <span className="size-1.5 rounded-full bg-gold" />
            <span className="size-1.5 rounded-full bg-line-strong" />
            <span className="size-1.5 rounded-full bg-line-strong" />
          </div>
        </MemberPost>
      </div>
    </Illustration>
  );
}

/** Used only while the library has no published collection to show. */
export function LibraryPreview() {
  const items = [
    { hue: 34, seed: "lib-a", theme: "vídeo episódio", locked: false },
    { hue: 210, seed: "lib-b", theme: "curso guia", locked: true },
    { hue: 160, seed: "lib-c", theme: "bastidores", locked: true },
    { hue: 300, seed: "lib-d", theme: "aprender", locked: false },
  ];
  return (
    <Illustration label="Ilustração da biblioteca de vídeos: colecções abertas a todos os membros e colecções exclusivas com cadeado.">
      <TopBar active={1} />
      <div className="grid grid-cols-2 gap-2.5 bg-mist p-3 sm:p-4">
        {items.map((v) => (
          <div key={v.seed} className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
            <CoverArt hue={v.hue} seed={v.seed} glyph={glyphFor(v.theme)} className="aspect-video">
              <div className="flex h-full items-center justify-center">
                <span className="grid size-7 place-items-center rounded-full bg-ink/75 text-white">{v.locked ? <Lock className="size-3.5" /> : <Play className="size-3.5 fill-current" />}</span>
              </div>
            </CoverArt>
            <div className="flex items-center justify-between gap-2 p-2">
              <span className="block h-2 w-3/5 rounded-full bg-ink/80" />
              <span className={cx("rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold", v.locked ? "bg-gold-soft text-gold-strong ring-1 ring-gold-line" : "bg-sunken text-ink-2")}>
                {v.locked ? "Exclusivo" : "Aberto"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Illustration>
  );
}

/** A member profile as a template of the visitor's own: no real person is shown. */
export function ProfilePreview() {
  return (
    <Illustration label="Ilustração de um perfil de membro: nome, o que está a construir, competências, projectos e conquistas em desafios.">
      <TopBar active={4} />
      <div className="space-y-3 bg-mist p-3 sm:p-4">
        <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-line">
          <CommunityBanner className="h-14" />
          <div className="px-3 pb-3">
            <span className="relative -mt-6 grid size-12 place-items-center rounded-full bg-gold-soft text-gold-strong ring-4 ring-surface">
              <UserRound className="size-6" />
            </span>
            <p className="mt-1.5 font-display text-[14px] font-bold text-ink">O seu nome</p>
            <p className="text-[11.5px] text-ink-2">O que está a construir, numa frase.</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {["Produto", "Vendas", "Finanças"].map((s) => (
                <span key={s} className="rounded-full bg-sunken px-2 py-0.5 text-[10px] text-ink-2">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-surface p-2.5 ring-1 ring-line">
            <p className="text-[10.5px] font-semibold text-ink">Projectos</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] text-white" style={{ background: "linear-gradient(135deg, hsl(200 42% 34%), hsl(224 46% 20%))" }}>
                <FolderKanban className="size-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[11px] font-semibold text-ink">O seu projecto</p>
                <p className="text-[10px] text-muted">Protótipo</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-surface p-2.5 ring-1 ring-line">
            <p className="text-[10.5px] font-semibold text-ink">Conquistas</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold text-ink">
                <Trophy className="size-4" />
              </span>
              <p className="text-[10px] leading-snug text-muted">Lugares em desafios com resultados publicados</p>
            </div>
          </div>
        </div>
      </div>
    </Illustration>
  );
}
