"use client";

import { Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePostAction, pinAction } from "@/app/actions";
import { Dialog } from "./overlay";
import { toast } from "./toaster";
import { buttonClass } from "./ui";

/** Moderation on a post: the admin pins and removes any post; authors remove their own. */
export function PostActions({ postId, pinned, canPin, canDelete, afterDelete }: { postId: string; pinned: boolean; canPin: boolean; canDelete: boolean; afterDelete?: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  if (!canPin && !canDelete) return null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, done?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? "Não foi possível concluir.", "bad");
      else {
        if (r.message) toast(r.message);
        done?.();
      }
    });
  const icon = "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-muted hover:bg-sunken hover:text-ink disabled:opacity-50";
  return (
    <div className="ml-auto flex items-center">
      {canPin && (
        <button type="button" disabled={pending} className={icon} onClick={() => run(() => pinAction(postId, !pinned))} title={pinned ? "Desafixar" : "Fixar no topo"}>
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          <span className="sr-only">{pinned ? "Desafixar" : "Fixar no topo"}</span>
        </button>
      )}
      {canDelete && (
        <button type="button" disabled={pending} className={icon} onClick={() => setConfirm(true)} title="Remover publicação">
          <Trash2 className="size-4" />
          <span className="sr-only">Remover publicação</span>
        </button>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Remover publicação?"
        description="A publicação, os comentários e as reacções deixam de existir. Não é possível desfazer."
        size="sm"
        footer={
          <>
            <button type="button" className={buttonClass("secondary")} onClick={() => setConfirm(false)}>Cancelar</button>
            <button
              type="button"
              className={buttonClass("danger")}
              onClick={() => {
                setConfirm(false);
                run(() => deletePostAction(postId), () => afterDelete && router.push(afterDelete));
              }}
            >
              Remover
            </button>
          </>
        }
      />
    </div>
  );
}
