"use client";

import clsx from "clsx";
import { Bookmark, MessagesSquare, Share2, SmilePlus } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { commentAction, reactAction, saveAction } from "@/app/actions";
import { REACTION_EMOJI, REACTION_KINDS, type ReactionKind } from "@/lib/reactions";
import type { ReactionCount } from "@/server/community";
import { toast } from "../toaster";


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

function recount(counts: ReactionCount[], from: ReactionKind | null, to: ReactionKind | null) {
  const map = new Map(counts.map((c) => [c.kind, c.n]));
  if (from) map.set(from, (map.get(from) ?? 1) - 1);
  if (to) map.set(to, (map.get(to) ?? 0) + 1);
  return [...map.entries()].filter(([, n]) => n > 0).map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n || REACTION_KINDS.indexOf(a.kind) - REACTION_KINDS.indexOf(b.kind));
}

const chip = "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-semibold ring-1 ring-inset transition-colors active:scale-95 motion-reduce:active:scale-100";
const quiet = "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink";

/**
 * Interactions under a post: reactions as chips with their real counts (one
 * reaction per member; the same again removes it, another replaces it), the
 * comments, sharing and saving. Everything updates at once and settles on
 * what the server stored, or rolls back with a message.
 */
export function PostFooter({
  postId,
  title,
  reactions,
  mine,
  saved,
  comments,
  shown,
  inlineComment,
  children,
}: {
  postId: string;
  title: string;
  reactions: ReactionCount[];
  mine: ReactionKind | null;
  saved: boolean;
  comments: number;
  /** Comments already listed under the post. */
  shown: number;
  inlineComment?: boolean;
  children?: ReactNode;
}) {
  // Server props win whenever they change (after any revalidation).
  const key = JSON.stringify([reactions, mine, saved]);
  const [base, setBase] = useState(key);
  const [state, setState] = useState({ counts: reactions, mine });
  const [isSaved, setSaved] = useState(saved);
  if (base !== key) {
    setBase(key);
    setState({ counts: reactions, mine });
    setSaved(saved);
  }
  const [reacting, startReact] = useTransition();
  const [saving, startSave] = useTransition();
  const [picker, setPicker] = useState(false);
  const [pop, setPop] = useState<ReactionKind | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const react = (kind: ReactionKind) => {
    if (reacting) return;
    setPicker(false);
    const prev = state;
    const next = prev.mine === kind ? null : kind;
    setState({ counts: recount(prev.counts, prev.mine, next), mine: next });
    if (next) setPop(next);
    startReact(async () => {
      const r = await reactAction(postId, kind);
      if (r.ok) setState({ counts: r.counts ?? prev.counts, mine: r.kind ?? null });
      else {
        setState(prev);
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

  const hearts = state.counts.find((c) => c.kind === "heart")?.n ?? 0;
  const others = state.counts.filter((c) => c.kind !== "heart");
  const total = state.counts.reduce((t, c) => t + c.n, 0);
  return (
    <div className="px-3 pb-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => react("heart")}
          aria-pressed={state.mine === "heart"}
          aria-label={state.mine === "heart" ? "Retirar gosto" : "Gosto"}
          className={clsx(chip, state.mine === "heart" ? "bg-gold-soft text-ink ring-gold" : "bg-surface text-ink ring-line hover:bg-mist")}
        >
          <span aria-hidden onAnimationEnd={() => setPop(null)} className={clsx("text-[16px] leading-none", pop === "heart" && "animate-pop")}>
            {REACTION_EMOJI.heart.emoji}
          </span>
          {hearts > 0 && <span className="tabular">{hearts}</span>}
        </button>
        {others.slice(0, 3).map((c) => (
          <button
            key={c.kind}
            type="button"
            onClick={() => react(c.kind)}
            aria-pressed={state.mine === c.kind}
            aria-label={`${REACTION_EMOJI[c.kind].label}: ${c.n}${state.mine === c.kind ? " (a sua reacção; retirar)" : ""}`}
            className={clsx(chip, state.mine === c.kind ? "bg-gold-soft text-ink ring-gold" : "bg-surface text-ink ring-line hover:bg-mist")}
          >
            <span aria-hidden className={clsx("text-[16px] leading-none", pop === c.kind && "animate-pop")} onAnimationEnd={() => setPop(null)}>
              {REACTION_EMOJI[c.kind].emoji}
            </span>
            <span className="tabular">{c.n}</span>
          </button>
        ))}
        {others.length > 3 && (
          <span className={clsx(chip, "bg-surface text-ink-2 ring-line")} aria-label={`Mais ${others.length - 3} reacções`}>
            +{others.slice(3).reduce((t, c) => t + c.n, 0)}
          </span>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPicker((v) => !v)}
            aria-expanded={picker}
            aria-label="Escolher reacção"
            className={clsx(chip, "bg-surface text-ink-2 ring-line hover:bg-mist hover:text-ink")}
          >
            <SmilePlus className="size-[18px]" />
          </button>
          {picker && (
            <div role="group" aria-label="Reacções" className="absolute bottom-11 left-0 z-20 flex animate-rise gap-0.5 rounded-full bg-surface p-1 shadow-[var(--shadow-pop)] ring-1 ring-line">
              {REACTION_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => react(k)}
                  aria-label={REACTION_EMOJI[k].label}
                  aria-pressed={state.mine === k}
                  className={clsx("grid size-10 place-items-center rounded-full text-[21px] transition hover:scale-110 hover:bg-sunken", state.mine === k && "bg-gold-soft")}
                >
                  {REACTION_EMOJI[k].emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="flex-1" />
        {inlineComment ? (
          <button type="button" aria-label="Comentar" className={quiet} onClick={() => input.current?.focus()}>
            <MessagesSquare className="size-[18px]" /> <span className="tabular">{comments > 0 ? comments : ""}</span>
          </button>
        ) : (
          <a href="#comentar" aria-label="Comentar" className={quiet}>
            <MessagesSquare className="size-[18px]" /> <span className="tabular">{comments > 0 ? comments : ""}</span>
          </a>
        )}
        <button type="button" aria-label="Partilhar" className={quiet} onClick={() => sharePost(postId, title)}>
          <Share2 className="size-[18px]" />
        </button>
        <button type="button" onClick={toggleSave} aria-pressed={isSaved} aria-label={isSaved ? "Remover dos guardados" : "Guardar"} className={clsx(quiet, isSaved && "text-gold-strong")}>
          <Bookmark className={clsx("size-[18px]", isSaved && "fill-current")} />
        </button>
      </div>
      <div className="px-1">
        {total > 0 && (
          <p className="sr-only" aria-live="polite">
            {total === 1 ? "1 reacção" : `${total} reacções`}
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
