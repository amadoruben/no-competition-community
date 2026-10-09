"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTransition } from "react";
import { lessonAction } from "@/app/actions";
import { buttonClass } from "@/components/ui";

export function CompleteButton({ lessonId, done }: { lessonId: string; done: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => lessonAction(lessonId, !done))} className={buttonClass(done ? "secondary" : "accent", "md")}>
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
      {done ? "Concluída · desmarcar" : "Marcar como concluída"}
    </button>
  );
}
