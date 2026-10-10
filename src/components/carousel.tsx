"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Horizontal, scroll-snapping row. Works with touch (native scroll), keyboard
 * (the row is focusable: arrow keys scroll it; Tab moves through the cards)
 * and pointer (previous/next buttons). Items keep their own links.
 */
export function Carousel({
  title,
  subtitle,
  action,
  children,
  itemClassName,
  headingLevel = 2,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode[];
  itemClassName?: string;
  /** 3 when the carousel sits under a section's own heading. */
  headingLevel?: 2 | 3;
}) {
  const label = title;
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const row = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = row.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);
  const page = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.85, behavior: "smooth" });
  const button = "grid size-9 place-items-center rounded-full bg-surface text-ink ring-1 ring-line-strong transition hover:bg-sunken disabled:opacity-35";
  return (
    <section aria-roledescription="carrossel" aria-label={label}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <Heading className="font-display text-[20px] leading-tight font-bold">{title}</Heading>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {children.length > 1 && (
            <span className="hidden gap-2 sm:flex">
              <button type="button" className={button} onClick={() => page(-1)} disabled={edge.start} aria-label={`${label}: anteriores`}>
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" className={button} onClick={() => page(1)} disabled={edge.end} aria-label={`${label}: seguintes`}>
                <ChevronRight className="size-4" />
              </button>
            </span>
          )}
        </div>
      </div>
      <ul
        ref={row}
        tabIndex={0}
        aria-label={label}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-1 focus-visible:outline-offset-4 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {children.map((child, i) => (
          <li key={i} className={cx("shrink-0 snap-start", itemClassName ?? "w-[82%] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]")}>
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
