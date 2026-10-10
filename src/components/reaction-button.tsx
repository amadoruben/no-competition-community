"use client";

import clsx from "clsx";
import { HandHeart } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { reactAction } from "@/app/actions";
import { toast } from "./toaster";

export function ReactionButton({ postId, count, active }: { postId: string; count: number; active: boolean }) {
  const [, start] = useTransition();
  const [state, setState] = useOptimistic({ count, active });
  return (
    <button
      type="button"
      aria-pressed={state.active}
      title="Reconhecer (não conta para classificações)"
      onClick={() =>
        start(async () => {
          setState({ active: !state.active, count: state.count + (state.active ? -1 : 1) });
          const r = await reactAction(postId);
          // On failure the optimistic state reverts when the transition ends.
          if (!r.ok) toast(r.error ?? "Não foi possível registar a reacção.", "bad");
        })
      }
      className={clsx(
        "tabular flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] transition-colors",
        state.active ? "bg-volt-soft font-medium text-ink ring-1 ring-volt-strong/60" : "text-muted hover:bg-sunken hover:text-ink",
      )}
    >
      <HandHeart className="size-4" /> {state.count}
    </button>
  );
}
