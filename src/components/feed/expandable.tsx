"use client";

import clsx from "clsx";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Clamps long text to a few lines with "Ver mais"; short text shows as is. */
export function Expandable({ children, lines = 5 }: { children: ReactNode; lines?: 3 | 5 }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [children]);
  return (
    <div>
      <div ref={ref} className={clsx(!open && (lines === 3 ? "line-clamp-3" : "line-clamp-5"))}>
        {children}
      </div>
      {overflows && !open && (
        <button type="button" onClick={() => setOpen(true)} className="mt-1 text-[14px] font-medium text-muted hover:text-ink">
          Ver mais
        </button>
      )}
    </div>
  );
}
