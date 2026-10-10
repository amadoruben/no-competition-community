"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { createStoryAction } from "@/app/actions";
import { preparePhoto, type Photo } from "@/lib/client/photo";
import { Dialog } from "../overlay";
import { toast } from "../toaster";
import { buttonClass } from "../ui";

const MAX = 220;

/**
 * A story: one photo, a short text, or both. The photo is resized here and
 * checked again on the server. Stories stay in the bar for 7 days.
 */
export function StoryComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputId = useId();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  const reset = () => {
    setPhoto(null);
    setCaption("");
    setError(null);
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(png|jpe?g|webp|heic|heif)$/i.test(file.type) && !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)) {
      setError("Escolha uma fotografia (JPEG, PNG ou WebP).");
      return;
    }
    setReading(true);
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      setError("Não foi possível ler esta fotografia. Experimente outra.");
    } finally {
      setReading(false);
    }
  };
  const submit = () => {
    if (pending) return;
    if (!photo && !caption.trim()) return setError("Adicione uma fotografia ou escreva um texto.");
    const fd = new FormData();
    fd.set("caption", caption);
    if (photo) fd.set("image", photo.blob, "story.jpg");
    start(async () => {
      const r = await createStoryAction(null, fd);
      if (r?.ok) {
        toast("Story publicado.");
        reset();
        onClose();
        router.refresh();
      } else setError(r?.fieldErrors?.caption ?? r?.error ?? "Não foi possível publicar.");
    });
  };

  return (
    <Dialog
      open={open}
      onClose={() => (reset(), onClose())}
      title="Novo story"
      description="Fica no topo do Início durante 7 dias, para os membros da comunidade."
      footer={
        <>
          <button type="button" className={buttonClass("secondary")} onClick={() => (reset(), onClose())} disabled={pending}>
            Cancelar
          </button>
          <button type="button" className={buttonClass("accent", "md", "font-semibold")} onClick={submit} disabled={pending || reading}>
            {pending && <Loader2 className="size-4 animate-spin" />} {pending ? "A publicar…" : "Publicar story"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative mx-auto aspect-[9/16] w-[180px] overflow-hidden rounded-2xl bg-[radial-gradient(120%_80%_at_15%_0%,#4a3b22,#16130e_70%)] text-white">
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
              <img src={photo.url} alt="Pré-visualização do story" className="size-full object-cover" />
              <button type="button" onClick={() => setPhoto(null)} aria-label="Remover fotografia" className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white">
                <X className="size-4" />
              </button>
            </>
          ) : caption.trim() ? (
            <p className="grid size-full place-items-center p-4 text-center font-display text-[15px] leading-snug font-bold">{caption}</p>
          ) : (
            <label htmlFor={inputId} className="grid size-full cursor-pointer place-items-center p-4 text-center text-[13px] text-white/80 hover:bg-white/5">
              <span>
                {reading ? <Loader2 className="mx-auto size-7 animate-spin" /> : <ImagePlus className="mx-auto size-7" />}
                <span className="mt-2 block">Escolher fotografia</span>
              </span>
            </label>
          )}
          {photo && caption.trim() && (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-3 text-[12px] leading-snug">{caption}</p>
          )}
        </div>
        <div className="space-y-3">
          <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
          <label htmlFor={inputId} className={buttonClass("secondary", "md", "w-full cursor-pointer")}>
            <ImagePlus className="size-4" /> {photo ? "Trocar fotografia" : "Escolher fotografia"}
          </label>
          <div>
            <label htmlFor={`${inputId}-caption`} className="block text-[13px] font-medium">
              Texto (opcional com fotografia)
            </label>
            <textarea
              id={`${inputId}-caption`}
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX))}
              rows={4}
              maxLength={MAX}
              placeholder="O que quer partilhar?"
              className="mt-1.5 w-full rounded-xl bg-surface px-3.5 py-2.5 text-[16px] leading-relaxed ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-gold-strong focus:outline-none sm:text-[15px]"
            />
            <p className="mt-1 text-right text-[12px] text-muted tabular">
              {caption.length}/{MAX}
            </p>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
              {error}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
