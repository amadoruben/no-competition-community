"use client";

import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Pause, Play, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { deleteStoryAction } from "@/app/actions";
import { Art } from "../art";
import { BrandMark } from "../brand";
import { CoverArt, glyphFor } from "../cover-art";
import { toast } from "../toaster";
import { Avatar, cx } from "../ui";
import type { ViewerGroup, ViewerSlide } from "./types";

const DURATION = 6500;

/**
 * Full-screen story viewer on a native <dialog> (focus moves in, the page
 * behind is inert, Esc closes). Tap the right side or → for the next story,
 * the left side or ← for the previous; hold, Space or the pause button to
 * pause. Each story advances on its own after a few seconds.
 */
export function StoryViewer({
  groups: initial,
  start,
  onClose,
  onSeen,
}: {
  groups: ViewerGroup[];
  start: { group: number; slide: number };
  onClose: () => void;
  onSeen: (slideId: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const elapsed = useRef(0);
  const held = useRef<{ timer: ReturnType<typeof setTimeout> | null; on: boolean }>({ timer: null, on: false });
  const router = useRouter();
  const [groups, setGroups] = useState(initial);
  const [pos, setPos] = useState(start);
  const [paused, setPaused] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const group = groups[pos.group];
  const slide = group?.slides[pos.slide];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const next = useCallback(() => {
    setConfirming(false);
    const g = groups[pos.group];
    if (pos.slide < g.slides.length - 1) setPos({ group: pos.group, slide: pos.slide + 1 });
    else if (pos.group < groups.length - 1) setPos({ group: pos.group + 1, slide: 0 });
    else onClose();
  }, [groups, pos, onClose]);

  const prev = useCallback(() => {
    setConfirming(false);
    elapsed.current = 0;
    if (pos.slide > 0) setPos({ group: pos.group, slide: pos.slide - 1 });
    else if (pos.group > 0) setPos({ group: pos.group - 1, slide: groups[pos.group - 1].slides.length - 1 });
    else if (bar.current) bar.current.style.transform = "scaleX(0)";
  }, [groups, pos]);

  // Mark as seen and preload the next photo.
  useEffect(() => {
    if (!slide) return;
    elapsed.current = 0;
    onSeen(slide.id);
    const following = group.slides[pos.slide + 1] ?? groups[pos.group + 1]?.slides[0];
    if (following?.kind === "photo") new Image().src = following.photo.url;
  }, [slide, group, groups, pos, onSeen]);

  // Progress: advances the current bar frame by frame, paused while held, paused or hidden.
  useEffect(() => {
    if (!slide || paused || confirming) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      if (!document.hidden) elapsed.current += t - last;
      last = t;
      const p = Math.min(1, elapsed.current / DURATION);
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      if (p >= 1) next();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slide, paused, confirming, next]);

  if (!group || !slide) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    held.current.timer = setTimeout(() => {
      held.current.on = true;
      setPaused(true);
    }, 220);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (held.current.timer) clearTimeout(held.current.timer);
    if (held.current.on) {
      held.current.on = false;
      setPaused(false);
      return;
    }
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - box.left < box.width * 0.3) prev();
    else next();
  };

  const remove = () => {
    startDelete(async () => {
      const r = await deleteStoryAction(slide.id);
      if (!r.ok) return toast(r.error ?? "Não foi possível eliminar.", "bad");
      toast("Story eliminado.");
      router.refresh();
      setConfirming(false);
      const rest = group.slides.filter((s) => s.id !== slide.id);
      if (!rest.length && groups.length === 1) return onClose();
      setGroups((gs) => gs.map((g, k) => (k === pos.group ? { ...g, slides: rest } : g)).filter((g) => g.slides.length));
      setPos((p) => (rest.length ? { group: p.group, slide: Math.min(p.slide, rest.length - 1) } : { group: Math.min(p.group, groups.length - 2), slide: 0 }));
    });
  };

  const iconButton = "grid size-9 place-items-center rounded-full text-white/90 transition hover:bg-white/15";
  return (
    <dialog
      ref={ref}
      aria-label={`Stories de ${group.name}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        else if (e.key === "ArrowLeft") prev();
        else if (e.key === " " && !(e.target as HTMLElement).closest("a,button")) {
          e.preventDefault();
          setPaused((v) => !v);
        }
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-[#0e0c09] p-0 text-white backdrop:bg-black/85"
    >
      <div className="relative mx-auto flex h-full w-full max-w-[480px] sm:items-center sm:py-6">
        <div
          className="relative h-full w-full touch-manipulation overflow-hidden bg-[#1a1712] select-none sm:h-[min(100%,840px)] sm:rounded-[22px]"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => held.current.timer && clearTimeout(held.current.timer)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Slide slide={slide} name={group.name} onNavigate={onClose} />

          <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-3 pt-[max(12px,env(safe-area-inset-top))] pb-8">
            <div className="flex gap-1" aria-hidden>
              {group.slides.map((s, k) => (
                <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    ref={k === pos.slide ? bar : undefined}
                    className="block h-full origin-left bg-white"
                    style={{ transform: `scaleX(${k < pos.slide ? 1 : 0})` }}
                  />
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              {group.avatar.kind === "brand" ? (
                <BrandMark size={34} className="rounded-full" />
              ) : (
                <Avatar name={group.name} hue={group.avatar.hue} fileId={group.avatar.fileId} size={34} />
              )}
              <div className="min-w-0 leading-tight">
                {group.href ? (
                  <Link href={group.href} onClick={onClose} className="flex items-center gap-1 truncate text-[14px] font-semibold hover:underline">
                    {group.name}
                    {group.official && <BadgeCheck aria-label="Conta oficial No Competition" className="size-4 shrink-0 fill-white text-gold" />}
                  </Link>
                ) : (
                  <p className="flex items-center gap-1 text-[14px] font-semibold">{group.name}</p>
                )}
                <p className="text-[12px] text-white/70">{slide.ago}</p>
              </div>
              <div className="ml-auto flex items-center">
                <button type="button" className={iconButton} onClick={() => setPaused((v) => !v)} aria-label={paused ? "Continuar" : "Pausar"} aria-pressed={paused}>
                  {paused ? <Play className="size-[18px] fill-current" /> : <Pause className="size-[18px] fill-current" />}
                </button>
                {group.canDelete && slide.kind !== "digest" && (
                  <button type="button" className={iconButton} onClick={() => setConfirming(true)} aria-label="Eliminar este story">
                    <Trash2 className="size-[18px]" />
                  </button>
                )}
                <button type="button" className={iconButton} onClick={onClose} aria-label="Fechar stories">
                  <X className="size-5" />
                </button>
              </div>
            </div>
          </div>

          {confirming && (
            <div className="absolute inset-x-4 bottom-[max(24px,env(safe-area-inset-bottom))] z-20 rounded-2xl bg-surface p-4 text-ink shadow-[var(--shadow-pop)]" role="alertdialog" aria-label="Eliminar story">
              <p className="text-[15px] font-semibold">Eliminar este story?</p>
              <p className="mt-1 text-[13px] text-muted">Deixa de aparecer para todos. Não é possível desfazer.</p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="h-9 rounded-full px-4 text-[14px] font-medium hover:bg-sunken">
                  Cancelar
                </button>
                <button type="button" onClick={remove} disabled={deleting} className="h-9 rounded-full bg-bad px-4 text-[14px] font-semibold text-white disabled:opacity-60">
                  {deleting ? "A eliminar…" : "Eliminar"}
                </button>
              </div>
            </div>
          )}
        </div>
        <button type="button" onClick={prev} aria-label="Story anterior" className="absolute top-1/2 -left-14 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:grid">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={next} aria-label="Story seguinte" className="absolute top-1/2 -right-14 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:grid">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {`${group.name}: ${pos.slide + 1} de ${group.slides.length}${paused ? ", em pausa" : ""}`}
      </p>
    </dialog>
  );
}

function Slide({ slide, name, onNavigate }: { slide: ViewerSlide; name: string; onNavigate: () => void }) {
  if (slide.kind === "photo")
    return (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated /files URL */}
        <img src={slide.photo.url} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl" />
        {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated /files URL */}
        <img src={slide.photo.url} alt={slide.caption || `Story de ${name}`} className="absolute inset-0 size-full object-contain" draggable={false} />
        {slide.caption && (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-5 pt-20 pb-[max(32px,env(safe-area-inset-bottom))] text-[16px] leading-relaxed whitespace-pre-line">
            {slide.caption}
          </p>
        )}
      </div>
    );
  if (slide.kind === "text")
    return (
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_80%_at_15%_0%,#4a3b22,#16130e_70%)] px-8">
        <Rings />
        <p className="relative text-center font-display text-[26px] leading-snug font-bold whitespace-pre-line sm:text-[28px]">{slide.caption}</p>
      </div>
    );
  return (
    <div className="absolute inset-0 flex flex-col justify-center bg-[radial-gradient(120%_80%_at_15%_0%,#4a3b22,#16130e_70%)] px-5 pt-20 pb-10">
      <Rings />
      <div className="relative overflow-hidden rounded-[20px] bg-white/[0.06] ring-1 ring-white/12">
        {slide.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider thumbnail of a video the viewer may open
          <img src={slide.image} alt="" className="aspect-video w-full object-cover" />
        ) : slide.cover ? (
          <CoverArt hue={slide.cover.hue} seed={slide.cover.seed} glyph={glyphFor(slide.cover.theme)} className="aspect-video" />
        ) : (
          <div className="grid aspect-video place-items-center bg-white/[0.04]">
            <Art name={slide.art ?? "megaphone"} size={112} />
          </div>
        )}
        <div className="p-5">
          <span className="inline-flex rounded-full bg-gold px-2.5 py-1 text-[12px] font-semibold text-ink">{slide.label}</span>
          <p className="mt-3 font-display text-[22px] leading-snug font-bold">{slide.title}</p>
          {slide.detail && <p className="mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-white/75">{slide.detail}</p>}
          <Link href={slide.href} onClick={onNavigate} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-gold px-5 text-[15px] font-semibold text-ink transition hover:bg-gold-hover">
            {slide.cta} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Rings() {
  return (
    <svg aria-hidden viewBox="0 0 200 200" className={cx("pointer-events-none absolute -right-24 -bottom-24 size-[360px] opacity-40")}>
      <g fill="none" stroke="#c39b4a">
        <circle cx="100" cy="100" r="96" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="70" strokeWidth="0.9" />
        <circle cx="100" cy="100" r="44" strokeWidth="2" />
        <path d="M58 142 142 58" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
