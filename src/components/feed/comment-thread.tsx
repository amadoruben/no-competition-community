"use client";

import { CornerDownRight, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { commentAction, deleteCommentAction } from "@/app/actions";
import type { Role } from "@/db/schema";
import { Dialog } from "../overlay";
import { toast } from "../toaster";
import { Avatar, buttonClass } from "../ui";
import { AuthorBadge } from "./author-badge";

export type ThreadComment = {
  id: string;
  parentId: string | null;
  body: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorHue: number;
  authorAvatar: string | null;
  authorRole: Role;
  /** Formatted on the server ("há 2 h"), so server and browser render the same text. */
  when: string;
  at: string;
};

/**
 * All comments of a post with their replies (one level). "Responder" targets
 * the composer at a comment; authors and the admin can remove comments.
 */
export function CommentThread({ postId, comments, viewer, me }: { postId: string; comments: ThreadComment[]; viewer: { id: string; role: Role }; me: { name: string; hue: number; fileId: string | null } }) {
  const [replyTo, setReplyTo] = useState<ThreadComment | null>(null);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<ThreadComment | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const top = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);

  const reply = (c: ThreadComment) => {
    setReplyTo(c);
    input.current?.focus();
  };
  const send = () => {
    if (!value.trim() || pending) return;
    const fd = new FormData();
    fd.set("body", value);
    if (replyTo) fd.set("parentId", replyTo.id);
    start(async () => {
      const r = await commentAction(postId, null, fd);
      if (r?.ok) {
        setValue("");
        setReplyTo(null);
      } else toast(r?.error ?? "Não foi possível publicar o comentário.", "bad");
    });
  };
  const remove = (c: ThreadComment) => {
    setRemoving(null);
    start(async () => {
      const r = await deleteCommentAction(c.id);
      toast(r.ok ? "Comentário removido." : (r.error ?? "Não foi possível remover."), r.ok ? "ok" : "bad");
    });
  };

  const item = (c: ThreadComment, nested?: boolean) => (
    <li key={c.id} className="flex gap-3">
      <Link href={`/members/${c.authorHandle}`} tabIndex={-1} aria-hidden className="shrink-0 rounded-full">
        <Avatar name={c.authorName} hue={c.authorHue} fileId={c.authorAvatar} size={nested ? 28 : 34} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-sunken/70 px-3.5 py-2.5">
          <AuthorBadge name={c.authorName} handle={c.authorHandle} role={c.authorRole} className="text-[13.5px]" />
          <p className="mt-0.5 text-[14.5px] leading-relaxed whitespace-pre-line text-ink-2">{c.body}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-2 text-[12.5px] text-muted">
          <time dateTime={c.at}>{c.when}</time>
          <button type="button" onClick={() => reply(c)} className="font-semibold hover:text-ink">
            Responder
          </button>
          {(c.authorId === viewer.id || viewer.role === "investor") && (
            <button type="button" onClick={() => setRemoving(c)} className="font-semibold hover:text-bad">
              Remover
            </button>
          )}
        </div>
        {!nested && replies(c.id).length > 0 && (
          <ul className="mt-3 space-y-3">
            {replies(c.id).map((r) => item(r, true))}
          </ul>
        )}
      </div>
    </li>
  );

  return (
    <section id="comentarios" aria-labelledby="comments-title" className="-mx-4 border-y border-line/80 bg-surface px-4 py-5 sm:mx-0 sm:rounded-[20px] sm:border-0 sm:px-6 sm:shadow-[var(--shadow-card)] sm:ring-1 sm:ring-line/80">
      <h2 id="comments-title" className="text-[15px] font-semibold">
        {comments.length === 0 ? "Comentários" : comments.length === 1 ? "1 comentário" : `${comments.length} comentários`}
      </h2>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">Ainda sem comentários. Comece a conversa.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {top.map((c) => item(c))}
        </ul>
      )}

      <form
        id="comentar"
        className="mt-5 flex items-start gap-3 border-t border-line/70 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Avatar name={me.name} hue={me.hue} fileId={me.fileId} size={34} />
        <div className="min-w-0 flex-1">
          {replyTo && (
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] text-muted">
              <CornerDownRight className="size-3.5" /> A responder a <strong className="font-semibold text-ink">{replyTo.authorName}</strong>
              <button type="button" aria-label="Cancelar resposta" onClick={() => setReplyTo(null)} className="grid size-6 place-items-center rounded-full hover:bg-sunken hover:text-ink">
                <X className="size-3.5" />
              </button>
            </p>
          )}
          <textarea
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={2}
            maxLength={2000}
            aria-label={replyTo ? `Responder a ${replyTo.authorName}` : "Escrever um comentário"}
            placeholder={replyTo ? "Escreva a resposta…" : "Escreva um comentário…"}
            className="block w-full resize-y rounded-2xl bg-sunken/70 px-3.5 py-2.5 text-[16px] leading-relaxed outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ink sm:text-[14.5px]"
          />
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={!value.trim() || pending} className={buttonClass("primary", "sm")}>
              {pending && <Loader2 className="size-4 animate-spin" />} {replyTo ? "Responder" : "Comentar"}
            </button>
          </div>
        </div>
      </form>

      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remover comentário?"
        description="O comentário e as respostas a ele deixam de existir."
        size="sm"
        footer={
          <>
            <button type="button" className={buttonClass("secondary")} onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button type="button" className={buttonClass("danger")} onClick={() => removing && remove(removing)}>
              Remover
            </button>
          </>
        }
      />
    </section>
  );
}
