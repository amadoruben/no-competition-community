import {
  BookOpen,
  Bot,
  Building2,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Leaf,
  Lightbulb,
  Store,
  Truck,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";

/** Theme glyphs: a cover says what the challenge or collection is about. */
const GLYPHS: [RegExp, LucideIcon][] = [
  [/energ|clima|solar|sustent|ambient/i, Zap],
  [/(^|\W)ia(\W|$)|intelig|automa|dados|software/i, Bot],
  [/sa[uú]de|m[eé]dic|bem-estar|s[eé]nior/i, HeartPulse],
  [/finan|banc|pagament|dinheiro|contab/i, Wallet],
  [/log[ií]stic|mobilidade|transport|entrega/i, Truck],
  [/educa|ensino|escola|forma[cç][aã]o/i, GraduationCap],
  [/com[eé]rcio|retalho|loja|consum/i, Store],
  [/agri|aliment|comida/i, Leaf],
  [/cidade|urban|imobili/i, Building2],
  [/v[ií]deo|epis[oó]dio|bastidor/i, Clapperboard],
  [/aprend|curso|guia|pitch|ronda|avalia/i, BookOpen],
];

export function glyphFor(...texts: (string | null | undefined)[]): LucideIcon {
  const text = texts.filter(Boolean).join(" ");
  return GLYPHS.find(([re]) => re.test(text))?.[1] ?? Lightbulb;
}

/** Small deterministic hash so the same item always gets the same composition. */
function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/**
 * Generated cover art: an engineering grid, the brand's ∅ ring and a theme glyph,
 * tinted by the item's hue. Self-contained (no remote images), consistent at any
 * size, and never broken. Purely decorative: give the surrounding link a name.
 */
export function CoverArt({
  hue,
  seed,
  glyph: Glyph = Lightbulb,
  className,
  children,
  tone = "deep",
}: {
  hue: number;
  seed: string;
  glyph?: LucideIcon;
  className?: string;
  children?: ReactNode;
  /** "deep": dark poster; "brand": ink with volt, for the community itself. */
  tone?: "deep" | "brand";
}) {
  const r = seedOf(seed);
  const cx_ = 98 + r * 36; // ring centre in a 160×90 frame
  const cy_ = 42 + ((r * 7) % 1) * 10;
  const accent = tone === "brand" ? "#d4f24a" : `hsl(${hue} 85% 68%)`;
  const base = tone === "brand" ? "#101216" : `hsl(${hue} 34% 14%)`;
  const glow = tone === "brand" ? "rgb(212 242 74 / 0.16)" : `hsl(${hue} 80% 50% / 0.42)`;
  return (
    <div className={clsx("relative isolate overflow-hidden", className)} style={{ backgroundColor: base }}>
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(110% 100% at ${(cx_ / 160) * 100}% ${(cy_ / 90) * 100}%, ${glow}, transparent 62%)` }} />
      <div aria-hidden className="cover-grid absolute inset-0 opacity-70" />
      <svg aria-hidden viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <path d={`M${cx_ - 30} ${cy_ + 30} L${cx_ + 30} ${cy_ - 30}`} stroke={accent} strokeWidth="4.5" strokeLinecap="round" opacity="0.55" />
        <circle cx={cx_} cy={cy_} r="21" fill={base} />
        <circle cx={cx_} cy={cy_} r="30" fill="none" stroke={accent} strokeWidth="4.5" />
        <Glyph x={cx_ - 13} y={cy_ - 13} width={26} height={26} strokeWidth={1.4} color="rgb(255 255 255 / 0.92)" />
      </svg>
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}

/** Small square mark for lists: the cover's colours and glyph, centred. Pass the display class (e.g. `grid`). */
export function CoverTile({ hue, glyph: Glyph = Lightbulb, className }: { hue: number; glyph?: LucideIcon; className?: string }) {
  return (
    <span aria-hidden className={clsx("shrink-0 place-items-center", className)} style={{ backgroundColor: `hsl(${hue} 34% 14%)`, color: `hsl(${hue} 85% 68%)` }}>
      <Glyph className="size-5" strokeWidth={1.75} />
    </span>
  );
}
