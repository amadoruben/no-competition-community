"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTransition } from "react";
import { lessonAction } from "@/app/actions";
import { toast } from "@/components/toaster";
import { buttonClass } from "@/components/ui";

export function CompleteButton({ lessonId, done }: { lessonId: string; done: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() =>
        start(async () => {
          const r = await lessonAction(lessonId, !done);
          if (!r.ok) toast(r.error ?? "Não foi possível guardar.", "bad");
          else if (r.message) toast(r.message);
        })
      } className={buttonClass(done ? "secondary" : "accent", "md")}>
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
      {done ? "Visto · desmarcar" : "Marcar como visto"}
    </button>
  );
}
