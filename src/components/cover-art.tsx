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

const GOLD = "#c39b4a";

/**
 * Generated cover art: a deep jewel tone from the item's hue, fine gold
 * orbits around the brand's ∅ ring, and a theme glyph. Self-contained (no
 * remote images), consistent at any size, and never broken. Purely
 * decorative: give the surrounding link a name.
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
  /** "deep": jewel-tone poster; "brand": warm graphite, for the community itself; "light": for white pages. */
  tone?: "deep" | "brand" | "light";
}) {
  const r = seedOf(seed);
  const cx_ = 100 + r * 32; // ring centre in a 160×90 frame
  const cy_ = 40 + ((r * 7) % 1) * 12;
  const light = tone === "light";
  const base = tone === "brand" ? "#1f1c17" : light ? `hsl(${hue} 28% 95%)` : `hsl(${hue} 38% 19%)`;
  const glow = tone === "brand" ? "rgb(195 155 74 / 0.22)" : light ? "rgb(195 155 74 / 0.16)" : `hsl(${hue} 42% 36% / 0.85)`;
  const disk = light ? "#ffffff" : base;
  const glyphColor = light ? `hsl(${hue} 36% 28%)` : "rgb(255 255 255 / 0.94)";
  return (
    <div className={clsx("relative isolate overflow-hidden", className)} style={{ backgroundColor: base }}>
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(95% 110% at ${(cx_ / 160) * 100}% ${(cy_ / 90) * 100}%, ${glow}, transparent 66%)` }} />
      <div aria-hidden className={clsx("absolute inset-0", light ? "paper-grid opacity-60" : "cover-grid opacity-80")} />
      <svg aria-hidden viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <circle cx={cx_} cy={cy_} r="58" fill="none" stroke={GOLD} strokeWidth="0.6" opacity={light ? 0.45 : 0.3} />
        <circle cx={cx_} cy={cy_} r="44" fill="none" stroke={GOLD} strokeWidth="0.8" opacity={light ? 0.6 : 0.42} />
        <path d={`M${cx_ - 31} ${cy_ + 31} L${cx_ + 31} ${cy_ - 31}`} stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <circle cx={cx_} cy={cy_} r="23" fill={disk} />
        <circle cx={cx_} cy={cy_} r="29" fill="none" stroke={GOLD} strokeWidth="2.2" />
        <Glyph x={cx_ - 12} y={cy_ - 12} width={24} height={24} strokeWidth={1.4} color={glyphColor} />
      </svg>
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}

/**
 * The community's own banner: warm paper, a hairline grid and fine gold orbits
 * around the ring of the ∅ mark, with no theme glyph. For headers on white
 * pages (the member home, the landing page's illustrations). Decorative.
 */
export function CommunityBanner({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={clsx("relative isolate overflow-hidden bg-gold-soft", className)}>
      <div aria-hidden className="paper-grid absolute inset-0 opacity-70" />
      <svg aria-hidden viewBox="0 0 400 100" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 size-full">
        <g fill="none" stroke={GOLD} strokeLinecap="round">
          <circle cx="332" cy="50" r="122" strokeWidth="0.6" opacity="0.35" />
          <circle cx="332" cy="50" r="88" strokeWidth="0.8" opacity="0.5" />
          <circle cx="332" cy="50" r="52" strokeWidth="2.2" opacity="0.9" />
          <path d="M290 92 374 8" strokeWidth="2.2" opacity="0.9" />
        </g>
      </svg>
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}

/** Small square mark for lists: the cover's colours and glyph, centred. Pass the display class (e.g. `grid`). */
export function CoverTile({ hue, glyph: Glyph = Lightbulb, className }: { hue: number; glyph?: LucideIcon; className?: string }) {
  return (
    <span aria-hidden className={clsx("shrink-0 place-items-center", className)} style={{ backgroundColor: `hsl(${hue} 38% 19%)`, color: GOLD }}>
      <Glyph className="size-5" strokeWidth={1.75} />
    </span>
  );
}
