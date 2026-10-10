import { Inbox, Rocket, ShieldAlert, Zap } from "lucide-react";
import type { Metadata } from "next";
import { PhaseBadge, RankMedal, ScorePill, StageBadge } from "@/components/domain";
import {
  Avatar,
  Badge,
  BarList,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  ChallengeCover,
  EmptyState,
  FilterChips,
  Notice,
  PageHeader,
  Pagination,
  ProjectLogo,
  Progress,
  Skeleton,
  StatePanel,
  Tabs,
  type Tone,
} from "@/components/ui";
import { requireUser } from "@/server/session";
import { DesignInteractive } from "./interactive";

export const metadata: Metadata = { title: "Design system" };

const colors: [string, string, string][] = [
  ["paper", "#f6f5f0", "Fundo da aplicação"],
  ["surface", "#ffffff", "Cartões, painéis"],
  ["sunken", "#efede6", "Áreas recolhidas, hover"],
  ["line", "#e3e0d6", "Divisórias"],
  ["ink", "#101216", "Texto principal, acção primária"],
  ["ink-2", "#383d45", "Texto secundário"],
  ["muted", "#62666e", "Metadados (≥4.9:1)"],
  ["faint", "#868a92", "Só decorativo (ícones)"],
  ["volt", "#d4f24a", "Acento: acção principal, 'agora'"],
  ["ok", "#17704d", "Sucesso"],
  ["warn", "#a2500a", "Aviso, prazos"],
  ["bad", "#b42339", "Erro, destrutivo"],
  ["info", "#2846c2", "Informação"],
  ["violet", "#6d3fc0", "Em avaliação, investimento"],
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-line pt-8">
      <h2 className="mb-5 font-display text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Living reference: every item below is the production component. */
export default async function DesignPage() {
  await requireUser();
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Referência interna"
        title="Design system"
        description="Tokens e componentes reais da No Competition Community. O que aparece aqui é exactamente o que as páginas usam."
      />
      <FilterChips
        label="Secções"
        active=""
        items={[["cores", "Cores"], ["tipografia", "Tipografia"], ["accoes", "Acções"], ["formularios", "Formulários"], ["estados", "Estados"], ["dados", "Dados"], ["dominio", "Domínio"], ["a11y", "Acessibilidade"]].map(([k, l]) => ({ key: k, label: l, href: `#${k}` }))}
      />

      <Section id="cores" title="Cores">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {colors.map(([name, hex, use]) => (
            <div key={name} className="overflow-hidden rounded-xl ring-1 ring-line">
              <div className="h-14" style={{ background: hex }} />
              <div className="bg-surface p-2.5">
                <div className="text-[13px] font-semibold">{name}</div>
                <div className="font-mono text-[11px] text-muted">{hex}</div>
                <div className="mt-1 text-[11px] text-ink-2">{use}</div>
              </div>
            </div>
          ))}
        </div>
        <Notice className="mt-4">
          Contraste verificado (WCAG AA): ink 17:1, ink-2 10:1, muted ≥4.9:1 em paper/surface/sunken; texto sobre fundos de estado ≥5:1. O volt é usado como fundo, nunca como cor de texto sobre claro.
        </Notice>
      </Section>

      <Section id="tipografia" title="Tipografia">
        <div className="space-y-3">
          <p className="font-display text-[44px] leading-tight font-semibold">Display · Bricolage Grotesque</p>
          <p className="font-display text-[28px] font-semibold">Título de página 28–34px</p>
          <p className="text-[15px] font-semibold">Título de cartão 15px semibold</p>
          <p className="text-[15px] text-ink-2">Corpo 15px · Geist. Legível, neutra, com algarismos tabulares para números.</p>
          <p className="text-[13px] text-muted">Metadados 13px · muted</p>
          <p className="tabular font-mono text-sm">Números 1 234,5 · Geist Mono</p>
        </div>
      </Section>

      <Section id="accoes" title="Acções">
        <div className="flex flex-wrap gap-2">
          <Button>Primária</Button>
          <Button variant="accent">Acento</Button>
          <Button variant="secondary">Secundária</Button>
          <Button variant="ghost">Discreta</Button>
          <Button variant="danger">Destrutiva</Button>
          <Button disabled>Desactivada</Button>
          <Button size="sm">Pequena</Button>
          <Button size="lg" variant="accent">Grande</Button>
        </div>
        <p className="mt-3 text-[13px] text-muted">Uma acção acento por ecrã. Acções irreversíveis pedem confirmação num diálogo.</p>
      </Section>

      <Section id="formularios" title="Formulários">
        <DesignInteractive />
      </Section>

      <Section id="estados" title="Estados">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><EmptyState icon={<Inbox className="size-5" />} title="Vazio">Explica o que falta e oferece o próximo passo.</EmptyState></Card>
          <Card className="space-y-3 p-5">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </Card>
          <div className="space-y-2">
            <Notice tone="info">Informação neutra.</Notice>
            <Notice tone="ok">Operação concluída e guardada.</Notice>
            <Notice tone="warn">Atenção: faltam avaliações.</Notice>
            <Notice tone="bad">Não foi possível guardar.</Notice>
          </div>
          <Card><StatePanel icon={<ShieldAlert className="size-6" />} tone="warn" title="Sem permissão">Este conteúdo é visível apenas para a equipa do projecto.</StatePanel></Card>
        </div>
      </Section>

      <Section id="dados" title="Dados e navegação">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="BarList" subtitle="Uma série, uma cor, valores em texto" />
            <div className="p-5">
              <BarList label="Exemplo" max={100} items={[{ key: "a", label: "Rota Curta", value: 87.3 }, { key: "b", label: "Entrega Verde", value: 70.7 }, { key: "c", label: "Lote Zero", value: 66.7 }]} format={(v) => v.toFixed(1).replace(".", ",")} />
            </div>
          </Card>
          <Card className="space-y-5 p-5">
            <Breadcrumbs items={[{ label: "Desafios", href: "/challenges" }, { label: "Energia acessível para PME" }]} />
            <Tabs active="a" items={[{ key: "a", label: "Visão geral", href: "#dados" }, { key: "b", label: "Regras", href: "#dados" }, { key: "c", label: "Participantes", href: "#dados", count: 5 }]} />
            <Progress value={64} tone="volt" />
            <Pagination page={2} pages={5} total={48} label="resultados" href={() => "#dados"} />
          </Card>
        </div>
      </Section>

      <Section id="dominio" title="Componentes de domínio">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              {(["draft", "upcoming", "open", "paused", "reviewing", "results"] as const).map((p) => <PhaseBadge key={p} phase={p} />)}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["idea", "prototype", "mvp", "traction", "scaling"] as const).map((s) => <StageBadge key={s} stage={s} />)}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["neutral", "volt", "ok", "warn", "bad", "info", "violet", "dark"] as Tone[]).map((t) => <Badge key={t} tone={t}>{t}</Badge>)}
            </div>
            <div className="flex items-center gap-3">
              <RankMedal rank={1} /><RankMedal rank={2} /><RankMedal rank={3} /><RankMedal rank={4} />
              <ScorePill score={87.3} /><ScorePill score={70} /><ScorePill score={55} /><ScorePill score={40} /><ScorePill score={null} />
            </div>
            <div className="flex items-center gap-3">
              <Avatar name="Ana Ribeiro" hue={150} /><Avatar name="Bruno Costa" hue={210} size={44} />
              <ProjectLogo name="Voltaica" hue={85} /><ProjectLogo name="Balcão" hue={260} size={56} />
            </div>
          </Card>
          <ChallengeCover hue={200} className="flex min-h-48 flex-col justify-between rounded-[20px] p-6 text-white">
            <div className="flex gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px]">Fintech</span><PhaseBadge phase="open" /></div>
            <div>
              <div className="font-display text-2xl font-semibold">Capa gerada a partir de um matiz</div>
              <div className="mt-1 flex items-center gap-3 text-sm text-white/80"><Zap className="size-4" /> Sem imagens de banco · <Rocket className="size-4" /> consistente</div>
            </div>
          </ChallengeCover>
        </div>
      </Section>

      <Section id="a11y" title="Regras de acessibilidade">
        <ul className="grid gap-2 text-[15px] text-ink-2 sm:grid-cols-2">
          {[
            "Foco visível em todos os elementos interactivos (contorno ink de 2px).",
            "Diálogos nativos (<dialog>): foco preso, Esc fecha, foco devolvido.",
            "Nunca só cor: estados têm texto/ícone; notas têm número.",
            "Navegação por teclado: link 'Saltar para o conteúdo', ordem lógica.",
            "Alvos de toque ≥ 32px; navegação móvel em gaveta abaixo de 768px.",
            "Formulários: rótulos visíveis, erros por campo ligados por aria-describedby.",
            "Tabelas ordenáveis anunciam a ordenação (aria-sort).",
            "Movimento discreto; nenhuma informação depende de animação.",
          ].map((r) => <li key={r} className="rounded-xl bg-surface p-3 ring-1 ring-line">{r}</li>)}
        </ul>
      </Section>
    </div>
  );
}
