"use client";

import clsx from "clsx";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { commentAction, reactAction, saveAction } from "@/app/actions";
import { toast } from "../toaster";

const icon = "grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-sunken active:scale-95 motion-reduce:active:scale-100";

/** Shares the post with the device's share sheet, or copies its link. */
export async function sharePost(postId: string, title: string) {
  const url = `${location.origin}/community/${postId}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast("Link copiado. Abre a publicação para quem tem sessão iniciada na comunidade.");
  } catch (e) {
    if ((e as Error).name !== "AbortError") toast("Não foi possível partilhar. Copie o endereço da página da publicação.", "bad");
  }
}

/**
 * Interactions under a post. Reactions and saves update at once and reconcile
 * with what the server stored (or roll back with a message if it fails).
 */
export function PostFooter({
  postId,
  title,
  reactions,
  reacted,
  saved,
  comments,
  shown,
  inlineComment,
  children,
}: {
  postId: string;
  title: string;
  reactions: number;
  reacted: boolean;
  saved: boolean;
  comments: number;
  /** Comments already listed under the post. */
  shown: number;
  inlineComment?: boolean;
  children?: ReactNode;
}) {
  // Server props win whenever they change (after any revalidation).
  const [base, setBase] = useState({ reactions, reacted, saved });
  const [like, setLike] = useState({ active: reacted, count: reactions });
  const [isSaved, setSaved] = useState(saved);
  if (base.reactions !== reactions || base.reacted !== reacted || base.saved !== saved) {
    setBase({ reactions, reacted, saved });
    setLike({ active: reacted, count: reactions });
    setSaved(saved);
  }
  const [liking, startLike] = useTransition();
  const [saving, startSave] = useTransition();
  const [pop, setPop] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const toggleLike = () => {
    if (liking) return;
    const prev = like;
    setLike({ active: !prev.active, count: prev.count + (prev.active ? -1 : 1) });
    if (!prev.active) setPop(true);
    startLike(async () => {
      const r = await reactAction(postId);
      if (r.ok) setLike({ active: !!r.active, count: r.count ?? prev.count });
      else {
        setLike(prev);
        toast(r.error ?? "Não foi possível registar a reacção.", "bad");
      }
    });
  };
  const toggleSave = () => {
    if (saving) return;
    const prev = isSaved;
    setSaved(!prev);
    startSave(async () => {
      const r = await saveAction(postId);
      if (r.ok) {
        setSaved(!!r.active);
        toast(r.active ? "Guardado. Encontra-o no filtro Guardados." : "Removido dos guardados.");
      } else {
        setSaved(prev);
        toast(r.error ?? "Não foi possível guardar.", "bad");
      }
    });
  };

  return (
    <div className="px-2 pb-3 sm:px-3">
      <div className="flex items-center">
        <button type="button" onClick={toggleLike} aria-pressed={like.active} aria-label={like.active ? "Retirar gosto" : "Gosto"} className={icon}>
          <Heart
            onAnimationEnd={() => setPop(false)}
            className={clsx("size-6", like.active && "fill-heart text-heart", pop && "animate-pop")}
            strokeWidth={1.8}
          />
        </button>
        {inlineComment ? (
          <button type="button" aria-label="Comentar" className={icon} onClick={() => input.current?.focus()}>
            <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.8} />
          </button>
        ) : (
          <a href="#comentar" aria-label="Comentar" className={icon}>
            <MessageCircle className="size-6 -scale-x-100" strokeWidth={1.8} />
          </a>
        )}
        <button type="button" aria-label="Partilhar" className={icon} onClick={() => sharePost(postId, title)}>
          <Send className="size-[22px]" strokeWidth={1.8} />
        </button>
        <button type="button" onClick={toggleSave} aria-pressed={isSaved} aria-label={isSaved ? "Remover dos guardados" : "Guardar"} className={clsx(icon, "ml-auto")}>
          <Bookmark className={clsx("size-6", isSaved && "fill-ink")} strokeWidth={1.8} />
        </button>
      </div>
      <div className="px-2">
        {like.count > 0 && (
          <p className="tabular text-[14px] font-semibold" aria-live="polite">
            {like.count} {like.count === 1 ? "gosto" : "gostos"}
          </p>
        )}
        {children}
        {comments > shown && (
          <Link href={`/community/${postId}#comentarios`} className="mt-1 block text-[14px] text-muted hover:text-ink">
            {shown === 0 ? (comments === 1 ? "Ver 1 comentário" : `Ver os ${comments} comentários`) : `Ver todos os ${comments} comentários`}
          </Link>
        )}
        {inlineComment && <InlineComment postId={postId} inputRef={input} />}
      </div>
    </div>
  );
}

function InlineComment({ postId, inputRef }: { postId: string; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-2 flex items-center gap-2 border-t border-line/70 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim() || pending) return;
        const fd = new FormData();
        fd.set("body", value);
        start(async () => {
          const r = await commentAction(postId, null, fd);
          if (r?.ok) setValue("");
          else toast(r?.error ?? "Não foi possível publicar o comentário.", "bad");
        });
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        enterKeyHint="send"
        aria-label="Escrever um comentário"
        placeholder="Adicionar um comentário…"
        className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted sm:text-[14px]"
      />
      <button type="submit" aria-label="Publicar comentário" disabled={!value.trim() || pending} className="h-9 rounded-full px-3 text-[14px] font-semibold text-ink transition-opacity disabled:opacity-35">
        {pending ? "A publicar…" : "Publicar"}
      </button>
    </form>
  );
}
