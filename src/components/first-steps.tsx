import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Card, cx, Progress } from "./ui";

export type Step = { done: boolean; title: string; detail: string; href: string; cta: string };

/** "Primeiros passos": shown until every step is done, so an empty platform always says what to do next. */
export function FirstSteps({ title = "Primeiros passos", steps, compact }: { title?: string; steps: Step[]; compact?: boolean }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);
  if (compact)
    return (
      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <h2 className="font-display text-[16px] font-semibold">{title}</h2>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={(done / steps.length) * 100} tone="gold" className="flex-1" />
            <span className="tabular text-[12px] text-muted">{done}/{steps.length}</span>
          </div>
        </div>
        <ol className="px-2 pb-2">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className={cx("group flex items-center gap-3 rounded-xl px-2 py-2", i === next ? "bg-gold-soft" : "hover:bg-sunken/70")}
                aria-label={s.done ? `${s.title} (concluído)` : `${s.title}: ${s.cta}`}
              >
                <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold", s.done ? "bg-ink text-gold" : i === next ? "bg-gold text-ink ring-1 ring-gold-strong" : "bg-sunken text-muted")}>
                  {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cx("min-w-0 flex-1 text-[13px] leading-snug", s.done ? "text-muted line-through" : "font-medium text-ink")}>{s.title}</span>
                {!s.done && <ArrowRight className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    );
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-[13px] text-muted">{done} de {steps.length} concluídos</p>
        </div>
        <Progress value={(done / steps.length) * 100} tone="gold" className="w-40" />
      </div>
      <ol className="divide-y divide-line/70">
        {steps.map((s, i) => (
          <li key={s.title} className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:flex-nowrap", i === next && "bg-gold/10")}>
            <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold", s.done ? "bg-ink text-gold" : i === next ? "bg-gold text-ink" : "bg-sunken text-muted")}>
              {s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-[calc(100%-3rem)] flex-1 sm:min-w-0">
              <p className={cx("text-sm font-medium", s.done && "text-muted line-through")}>{s.title}</p>
              {!s.done && <p className="text-[13px] text-muted">{s.detail}</p>}
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className={cx("ml-12 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium sm:ml-0", i === next ? "bg-ink text-white hover:bg-ink-2" : "ring-1 ring-line hover:bg-sunken")}
              >
                {s.cta} <ArrowRight className="size-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
