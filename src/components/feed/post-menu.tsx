"use client";

import clsx from "clsx";
import { ExternalLink, Link2, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { deletePostAction, pinAction, updatePostAction } from "@/app/actions";
import type { AnyPostKind, PostKind } from "@/db/schema";
import { POST_KIND_LABEL } from "@/lib/labels";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "../form";
import { Dialog } from "../overlay";
import { toast } from "../toaster";
import { buttonClass } from "../ui";

type Post = { id: string; kind: AnyPostKind; title: string; body: string; pinned: boolean };

/**
 * "⋯" menu with only the actions this viewer may take. Arrow keys move
 * between items, Esc closes and returns focus to the button.
 */
export function PostMenu({
  post,
  isAuthor,
  isAdmin,
  inFeed,
}: {
  post: Post;
  isAuthor: boolean;
  isAdmin: boolean;
  /** In the feed the menu also links to the post's own page. */
  inFeed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") close();
    else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  };

  const copy = async () => {
    close();
    try {
      await navigator.clipboard.writeText(`${location.origin}/community/${post.id}`);
      toast("Link copiado.");
    } catch {
      toast("Não foi possível copiar o link.", "bad");
    }
  };
  const pin = () => {
    close();
    start(async () => {
      const r = await pinAction(post.id, !post.pinned);
      toast(r.ok ? (post.pinned ? "Publicação desafixada." : "Publicação fixada no topo.") : (r.error ?? "Não foi possível concluir."), r.ok ? "ok" : "bad");
    });
  };
  const remove = () => {
    setDialog(null);
    start(async () => {
      const r = await deletePostAction(post.id);
      if (!r.ok) return toast(r.error ?? "Não foi possível remover.", "bad");
      toast("Publicação removida.");
      if (!inFeed) router.push("/dashboard");
    });
  };

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] outline-none hover:bg-sunken focus-visible:bg-sunken";
  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Mais acções"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className="-mr-2 grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-50"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label="Acções da publicação"
          onKeyDown={onKeyDown}
          className="absolute top-10 right-0 z-30 w-60 animate-rise rounded-2xl bg-surface p-1.5 shadow-[var(--shadow-pop)] ring-1 ring-line"
        >
          <button role="menuitem" type="button" className={item} onClick={copy}>
            <Link2 className="size-4 text-muted" /> Copiar link
          </button>
          {inFeed && (
            <button role="menuitem" type="button" className={item} onClick={() => router.push(`/community/${post.id}`)}>
              <ExternalLink className="size-4 text-muted" /> Abrir publicação
            </button>
          )}
          {isAuthor && post.kind !== "social" && (
            <button role="menuitem" type="button" className={item} onClick={() => (close(false), setDialog("edit"))}>
              <Pencil className="size-4 text-muted" /> Editar
            </button>
          )}
          {isAdmin && post.kind === "social" && (
            <button role="menuitem" type="button" className={item} onClick={() => router.push(`/admin/social?edit=${post.id}`)}>
              <Pencil className="size-4 text-muted" /> Editar em Conteúdos sociais
            </button>
          )}
          {isAdmin && (
            <button role="menuitem" type="button" className={item} onClick={pin}>
              {post.pinned ? <PinOff className="size-4 text-muted" /> : <Pin className="size-4 text-muted" />}
              {post.pinned ? "Desafixar" : "Fixar no topo"}
            </button>
          )}
          {(isAuthor || isAdmin) && (
            <button role="menuitem" type="button" className={clsx(item, "text-bad")} onClick={() => (close(false), setDialog("delete"))}>
              <Trash2 className="size-4" /> Remover publicação
            </button>
          )}
        </div>
      )}

      <Dialog open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar publicação" size="lg">
        <EditForm post={post} canAnnounce={isAdmin} onDone={() => setDialog(null)} />
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Remover publicação?"
        description="A publicação, as fotografias, os comentários e as reacções deixam de existir. Não é possível desfazer."
        size="sm"
        footer={
          <>
            <button type="button" className={buttonClass("secondary")} onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button type="button" className={buttonClass("danger")} onClick={remove}>
              Remover
            </button>
          </>
        }
      />
    </div>
  );
}

function EditForm({ post, canAnnounce, onDone }: { post: Post; canAnnounce: boolean; onDone: () => void }) {
  const kinds: PostKind[] = ["discussion", "question", "progress", ...(canAnnounce || post.kind === "announcement" ? (["announcement"] as const) : [])];
  const current = kinds.find((k) => k === post.kind) ?? "discussion";
  return (
    <ActionForm action={updatePostAction.bind(null, post.id)} onSuccess={onDone} className="space-y-4">
      <KindPicker kinds={kinds} defaultValue={current} />
      <Field name="title" label="Título (opcional)">
        <Input name="title" defaultValue={post.title} maxLength={140} />
      </Field>
      <Field name="body" label="Texto">
        <Textarea name="body" defaultValue={post.body} rows={6} maxLength={5000} className="text-[16px] sm:text-[15px]" />
      </Field>
      <p className="text-[13px] text-muted">As fotografias e o vídeo ficam como foram publicados.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={buttonClass("secondary")}>
          Cancelar
        </button>
        <SubmitButton pendingLabel="A guardar…">Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Post type as a row of radio chips (a native radio group: arrow keys work). */
export function KindPicker({ kinds, defaultValue, value, onChange }: { kinds: PostKind[]; defaultValue?: PostKind; value?: PostKind; onChange?: (k: PostKind) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Tipo de publicação</legend>
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <label key={k} className="cursor-pointer">
            <input
              type="radio"
              name="kind"
              value={k}
              defaultChecked={value === undefined ? k === defaultValue : undefined}
              checked={value === undefined ? undefined : k === value}
              onChange={() => onChange?.(k)}
              className="peer sr-only"
            />
            <span className="inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-ink-2 ring-1 ring-line-strong transition peer-checked:bg-ink peer-checked:text-white peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:bg-sunken peer-checked:hover:bg-ink">
              {k === "announcement" ? "Anúncio oficial" : k === "discussion" ? "Conversa" : POST_KIND_LABEL[k]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
