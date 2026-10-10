import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Card, cx, Progress } from "./ui";

export type Step = { done: boolean; title: string; detail: string; href: string; cta: string };

/** "Primeiros passos": shown until every step is done, so an empty platform always says what to do next. */
export function FirstSteps({ title = "Primeiros passos", steps }: { title?: string; steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-[13px] text-muted">{done} de {steps.length} concluídos</p>
        </div>
        <Progress value={(done / steps.length) * 100} tone="volt" className="w-40" />
      </div>
      <ol className="divide-y divide-line/70">
        {steps.map((s, i) => (
          <li key={s.title} className={cx("flex items-center gap-4 px-5 py-3.5", i === next && "bg-volt/10")}>
            <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold", s.done ? "bg-ink text-volt" : i === next ? "bg-volt text-ink" : "bg-sunken text-muted")}>
              {s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("text-sm font-medium", s.done && "text-muted line-through")}>{s.title}</p>
              {!s.done && <p className="text-[13px] text-muted">{s.detail}</p>}
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium", i === next ? "bg-ink text-white hover:bg-ink-2" : "ring-1 ring-line hover:bg-sunken")}
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
