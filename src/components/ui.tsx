import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

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
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
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

export function Avatar({ name, hue, size = 36, className }: { name: string; hue: number; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center rounded-full font-semibold select-none", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `hsl(${hue} 70% 88%)`,
        color: `hsl(${hue} 55% 25%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function ProjectLogo({ name, hue, size = 44, className }: { name: string; hue: number; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center font-display font-bold text-white select-none", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(140deg, hsl(${hue} 70% 45%), hsl(${hue + 30} 65% 28%))`,
      }}
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
        {eyebrow && <div className="mb-2 text-[13px] font-medium text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[28px] leading-tight font-semibold sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-sunken text-muted">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
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
