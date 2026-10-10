import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CoverArt, glyphFor } from "./cover-art";

export { clsx as cx };

// Buttons ----------------------------------------------------------------------

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background,color,box-shadow,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-[15px]",
    variant === "primary" && "bg-ink text-white hover:bg-ink-2",
    variant === "accent" && "bg-volt text-ink hover:bg-volt-strong",
    variant === "secondary" && "bg-surface text-ink ring-1 ring-line-strong ring-inset hover:bg-sunken",
    variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
    variant === "danger" && "bg-surface text-bad ring-1 ring-bad/30 ring-inset hover:bg-bad-soft",
    extra,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// Surfaces ---------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={clsx("rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/70", className)}
      {...props}
    />
  );
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
      <div className="min-w-0">
        <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Badges -----------------------------------------------------------------------

export type Tone = "neutral" | "volt" | "ok" | "warn" | "bad" | "info" | "violet" | "dark";

const toneClass: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  volt: "bg-volt-soft text-ink ring-1 ring-inset ring-volt-strong/50",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
  dark: "bg-ink text-white",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

// Identity ---------------------------------------------------------------------

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Stable, provider-neutral URL for an uploaded file. */
export const fileUrl = (id: string) => `/files/${id}`;

export function Avatar({ name, hue, size = 36, fileId, className }: { name: string; hue: number; size?: number; fileId?: string | null; className?: string }) {
  const box = { width: size, height: size };
  if (fileId)
    // eslint-disable-next-line @next/next/no-img-element -- auth-gated, provider-neutral URL; no image optimiser needed
    return <img src={fileUrl(fileId)} alt="" width={size} height={size} loading="lazy" className={clsx("shrink-0 rounded-full object-cover", className)} style={box} />;
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center rounded-full font-semibold select-none", className)}
      style={{ ...box, fontSize: Math.round(size * 0.38), background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 55% 25%)` }}
    >
      {initials(name)}
    </span>
  );
}

export function ProjectLogo({ name, hue, size = 44, fileId, className }: { name: string; hue: number; size?: number; fileId?: string | null; className?: string }) {
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.28) };
  if (fileId)
    // eslint-disable-next-line @next/next/no-img-element -- see Avatar
    return <img src={fileUrl(fileId)} alt="" width={size} height={size} loading="lazy" className={clsx("shrink-0 bg-surface object-cover ring-1 ring-line", className)} style={box} />;
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center font-display font-bold text-white select-none", className)}
      style={{ ...box, fontSize: Math.round(size * 0.42), background: `linear-gradient(140deg, hsl(${hue} 70% 45%), hsl(${hue + 30} 65% 28%))` }}
    >
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

// Layout helpers ---------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">{eyebrow}</div>}
        <h1 className="font-display text-[28px] leading-[1.1] font-semibold sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Section title row used across pages: display face, optional action on the right. */
export function SectionTitle({ title, action, subtitle, id }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[20px] leading-tight font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, compact }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={clsx("flex flex-col items-center px-6 text-center", compact ? "py-8" : "py-14")}>
      {icon && (
        <div aria-hidden className="relative mb-4 grid size-14 place-items-center">
          <span className="absolute inset-0 rounded-full ring-[3px] ring-volt-strong/60" />
          <span className="absolute inset-[7px] rounded-full bg-volt-soft" />
          <span className="relative text-ink [&_svg]:size-5">{icon}</span>
        </div>
      )}
      <p className="font-display text-[17px] font-semibold text-ink">{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="tabular mt-1 font-display text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function Progress({ value, className, tone = "ink" }: { value: number; className?: string; tone?: "ink" | "volt" | "ok" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx("h-1.5 overflow-hidden rounded-full bg-sunken", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx("h-full rounded-full", tone === "ink" && "bg-ink", tone === "volt" && "bg-volt-strong", tone === "ok" && "bg-ok")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Renders plain text with paragraphs and line breaks. No HTML is interpreted. */
export function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={clsx("space-y-3 text-[15px] leading-relaxed text-ink-2", className)}>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
    </div>
  );
}

export function Tabs({ items, active }: { items: { key: string; label: ReactNode; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Separadores">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={t.key === active ? "page" : undefined}
          className={clsx(
            "relative -mb-px flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
            t.key === active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular rounded-full bg-sunken px-1.5 text-[11px] text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "ok" | "warn" | "bad"; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={clsx(
        "rounded-xl px-4 py-3 text-sm",
        tone === "info" && "bg-info-soft text-info",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Generated cover art for a challenge: its hue, its theme glyph (from category/title) and a stable composition. */
export function ChallengeCover({ hue, seed, theme, className, children }: { hue: number; seed?: string; theme?: string; className?: string; children?: ReactNode }) {
  return (
    <CoverArt hue={hue} seed={seed ?? String(hue)} glyph={glyphFor(theme)} className={className}>
      {children}
    </CoverArt>
  );
}

// Navigation helpers -------------------------------------------------------------

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Localização" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-muted">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-muted">/</span>}
            {it.href ? (
              <Link href={it.href} className="hover:text-ink hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[40ch] truncate text-ink">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Server-rendered pagination; `href(page)` builds the link for each page. */
export function Pagination({ page, pages, href, total, label = "resultados" }: { page: number; pages: number; href: (p: number) => string; total?: number; label?: string }) {
  if (pages <= 1) return total !== undefined ? <p className="mt-4 text-center text-[13px] text-muted">{total} {label}</p> : null;
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);
  const cell = "inline-grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm font-medium";
  return (
    <nav aria-label="Paginação" className="mt-6 flex flex-col items-center gap-2">
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? <Link href={href(page - 1)} className={clsx(cell, "hover:bg-sunken")} aria-label="Página anterior">‹</Link> : <span className={clsx(cell, "text-muted")}>‹</span>}
        </li>
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={clsx(cell, "tabular", n === page ? "bg-ink text-white" : "hover:bg-sunken")}>
              {n}
            </Link>
          </li>
        ))}
        <li>
          {page < pages ? <Link href={href(page + 1)} className={clsx(cell, "hover:bg-sunken")} aria-label="Página seguinte">›</Link> : <span className={clsx(cell, "text-muted")}>›</span>}
        </li>
      </ul>
      {total !== undefined && <p className="text-[13px] text-muted">{total} {label}</p>}
    </nav>
  );
}

/** Pill-style filter links (single choice). */
export function FilterChips({ items, active, label }: { items: { key: string; label: string; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          scroll={false}
          aria-current={it.key === active ? "true" : undefined}
          className={clsx(
            "h-8 rounded-full px-3 text-[13px] leading-8 font-medium whitespace-nowrap ring-1 ring-inset transition-colors",
            it.key === active ? "bg-ink text-white ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-line-strong",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** GET search box that preserves other query params. */
export function SearchBox({ name = "q", defaultValue, placeholder, label, hidden = {} }: { name?: string; defaultValue?: string; placeholder: string; label: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form role="search" className="relative w-full sm:w-64">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-full bg-surface pr-3 pl-9 text-sm ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-ink focus:outline-none"
      />
    </form>
  );
}

/** Loading placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-lg bg-sunken", className)} />;
}

/** Full-width state for errors, missing permissions and unavailable services. */
export function StatePanel({ icon, title, children, action, tone = "neutral" }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; tone?: "neutral" | "bad" | "warn" }) {
  return (
    <div role={tone === "bad" ? "alert" : undefined} className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
      {icon && (
        <div className={clsx("mb-4 grid size-12 place-items-center rounded-2xl", tone === "bad" ? "bg-bad-soft text-bad" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-sunken text-muted")}>
          {icon}
        </div>
      )}
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {children && <div className="mt-2 text-[15px] text-ink-2">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

// Data display -------------------------------------------------------------------

/**
 * Horizontal bar list — one series, magnitude only. One hue (ink), values as
 * text (never colour alone), fixed scale when `max` is given so charts are
 * comparable. Exposed to assistive tech as a list with full labels.
 */
export function BarList({
  items,
  max,
  format = (v) => String(v),
  label,
}: {
  items: { key: string; label: ReactNode; value: number | null; hint?: ReactNode; href?: string }[];
  max?: number;
  format?: (v: number) => string;
  label: string;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value ?? 0));
  return (
    <ul aria-label={label} className="space-y-3">
      {items.map((it) => {
        const pct = it.value === null ? 0 : Math.max(0, Math.min(100, (it.value / top) * 100));
        const text = it.value === null ? "—" : format(it.value);
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{it.label}</span>
              <span className="tabular shrink-0 font-mono font-semibold text-ink">{text}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-sunken" title={`${typeof it.label === "string" ? it.label + ": " : ""}${text}`}>
              {it.value !== null && <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.max(pct, 1.5)}%` }} />}
            </div>
            {it.hint && <div className="mt-1 text-[12px] text-muted">{it.hint}</div>}
          </>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <Link href={it.href} className="block rounded-lg outline-offset-4 hover:[&_.bg-ink]:bg-ink-2">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Table header cell that links to a sorted view (server-side sorting via URL). */
export function SortHeader({ label, sortKey, current, dir, href, align = "left" }: { label: string; sortKey: string; current: string; dir: "asc" | "desc"; href: (key: string, dir: "asc" | "desc") => string; align?: "left" | "right" }) {
  const active = current === sortKey;
  const next = active && dir === "desc" ? "asc" : "desc";
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={clsx("px-4 py-2.5 font-medium", align === "right" && "text-right")}>
      <Link href={href(sortKey, next)} scroll={false} className={clsx("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label}
        <span aria-hidden className={clsx("text-[10px]", !active && "opacity-0")}>{dir === "asc" ? "▲" : "▼"}</span>
      </Link>
    </th>
  );
}
