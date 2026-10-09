"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string };
const listeners = new Set<(t: Toast) => void>();
let seq = 0;

/** Show a transient confirmation that survives the form re-rendering away. */
export function toast(message: string) {
  const t = { id: ++seq, message };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} role="status" className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pop)]">
          <span className="grid size-5 place-items-center rounded-full bg-volt text-ink"><Check className="size-3.5" /></span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
