"use client";

import clsx from "clsx";
import { ImagePlus, Link2, Loader2, Video, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPostAction } from "@/app/actions";
import type { PostKind } from "@/db/schema";
import { videoSource } from "@/lib/video";
import { toast } from "../toaster";
import { Avatar, buttonClass } from "../ui";
import { KindPicker } from "./post-menu";
import { preparePhoto as prepare, type Photo } from "@/lib/client/photo";

const MAX_PHOTOS = 6;
/** Below Vercel's 4.5 MB request limit with room for the form fields. */
const MAX_TOTAL = 3.6 * 1024 * 1024;

const PLACEHOLDER: Record<PostKind, string> = {
  discussion: "Partilhe uma ideia, uma novidade ou uma fotografia…",
  question: "O que quer perguntar à comunidade?",
  progress: "Em que ponto está o seu projecto?",
  announcement: "Escreva o anúncio para toda a comunidade…",
};

/**
 * Writing a post: type, optional title, text, up to six photos (resized here,
 * checked again on the server) or a video link, and an optional challenge.
 * The form keeps everything typed when the server refuses something.
 */
export function Composer({
  name,
  hue,
  fileId,
  canAnnounce,
  challenges,
}: {
  name: string;
  hue: number;
  fileId?: string | null;
  canAnnounce: boolean;
  challenges: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PostKind>("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [pending, start] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  // "Publicar" links elsewhere (e.g. first steps) point at #publicar.
  useEffect(() => {
    const check = () => location.hash === "#publicar" && setOpen(true);
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  useEffect(() => {
    if (open) text.current?.focus();
  }, [open]);
  // Grow the text area with its content.
  useEffect(() => {
    const t = text.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 420)}px`;
  }, [body, open]);

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setKind("discussion");
    setTitle("");
    setBody("");
    setPhotos([]);
    setVideo(null);
    setChallengeId("");
    setError(null);
    setOpen(false);
  };

  const addPhotos = async (files: File[]) => {
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    const chosen = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) toast(`No máximo ${MAX_PHOTOS} fotografias por publicação.`, "bad");
    setPreparing(true);
    const ready: Photo[] = [];
    for (const f of chosen) {
      try {
        ready.push(await prepare(f));
      } catch {
        toast(`Não foi possível ler “${f.name}”. Use JPEG, PNG ou WebP.`, "bad");
      }
    }
    setPreparing(false);
    setPhotos((ps) => [...ps, ...ready]);
    setVideo(null);
  };

  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = ""; // choosing the same photo again still fires
    setOpen(true);
    addPhotos(files);
  };

  const videoOk = video === null || video.trim() === "" || videoSource(video) !== null;
  const empty = !title.trim() && !body.trim() && !photos.length && !video?.trim();
  const total = photos.reduce((s, p) => s + p.blob.size, 0);

  const submit = () => {
    if (empty || !videoOk || pending || preparing) return;
    if (total > MAX_TOTAL) return setError({ message: "As fotografias ocupam demasiado espaço para uma publicação. Retire uma ou duas." });
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("title", title);
    fd.set("body", body);
    fd.set("videoUrl", video ?? "");
    if (challengeId) fd.set("challengeId", challengeId);
    photos.forEach((p, i) => fd.append("images", new File([p.blob], `fotografia-${i + 1}.jpg`, { type: "image/jpeg" })));
    setError(null);
    start(async () => {
      const r = await createPostAction(null, fd);
      if (r?.ok) {
        toast(kind === "announcement" ? "Anúncio publicado e fixado no topo." : "Publicado.");
        reset();
      } else setError({ message: r?.error ?? "Não foi possível publicar.", fields: r?.fieldErrors });
    });
  };

  if (!open)
    return (
      <div id="publicar" className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line/80">
        <Avatar name={name} hue={hue} fileId={fileId} size={38} />
        <button type="button" onClick={() => setOpen(true)} className="h-10 min-w-0 flex-1 truncate rounded-xl px-1 text-left text-[16px] text-muted hover:text-ink-2">
          Escreva algo…
        </button>
        <button type="button" aria-label="Publicar fotografias" onClick={() => picker.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken">
          <ImagePlus className="size-5" />
        </button>
        <input ref={picker} type="file" accept="image/*" multiple hidden onChange={choose} />
      </div>
    );

  const fieldError = (k: string) => error?.fields?.[k];
  return (
    <section
      id="publicar"
      aria-labelledby={titleId}
      className="-mx-4 border-y border-line/80 bg-surface transition-shadow focus-within:ring-2 focus-within:ring-ink/15 sm:mx-0 sm:rounded-[20px] sm:border-0 sm:shadow-[var(--shadow-pop)] sm:ring-1 sm:ring-line/80 sm:focus-within:ring-2 sm:focus-within:ring-ink/20"
    >
      <h2 id={titleId} className="sr-only">
        Nova publicação
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
          <Avatar name={name} hue={hue} fileId={fileId} size={40} />
          <div className="min-w-0 flex-1 space-y-3">
            <KindPicker kinds={["discussion", "question", "progress", ...(canAnnounce ? (["announcement"] as const) : [])]} value={kind} onChange={setKind} />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              aria-label="Título (opcional)"
              placeholder={kind === "announcement" ? "Título do anúncio" : "Título (opcional)"}
              aria-invalid={!!fieldError("title")}
              className="w-full bg-transparent text-[17px] font-semibold outline-none placeholder:font-medium placeholder:text-muted focus-visible:outline-none"
            />
            <textarea
              ref={text}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={3}
              aria-label="Texto da publicação"
              placeholder={PLACEHOLDER[kind]}
              aria-invalid={!!fieldError("body")}
              className="block w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-muted focus-visible:outline-none sm:text-[15px]"
            />
          </div>
        </div>

        {(photos.length > 0 || preparing) && (
          <ul className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:px-5" aria-label="Fotografias a publicar">
            {photos.map((p, i) => (
              <li key={p.url} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-sunken sm:size-28">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
                <img src={p.url} alt={`Fotografia ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={`Retirar fotografia ${i + 1}`}
                  onClick={() => (URL.revokeObjectURL(p.url), setPhotos((ps) => ps.filter((x) => x !== p)))}
                  className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-ink/75 text-white hover:bg-ink"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
            {preparing && (
              <li className="grid size-24 shrink-0 place-items-center rounded-xl bg-sunken text-muted sm:size-28" aria-live="polite">
                <Loader2 className="size-5 animate-spin" />
                <span className="sr-only">A preparar fotografias…</span>
              </li>
            )}
          </ul>
        )}

        {video !== null && (
          <div className="mx-4 mt-3 sm:mx-5">
            <label className="flex items-center gap-2 rounded-xl bg-sunken px-3 ring-1 ring-transparent focus-within:ring-line-strong">
              <Link2 className="size-4 shrink-0 text-muted" />
              <span className="sr-only">Link do vídeo</span>
              <input
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                autoFocus
                inputMode="url"
                placeholder="Link do YouTube, do Vimeo ou de um ficheiro .mp4"
                aria-invalid={!videoOk || !!fieldError("videoUrl")}
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted sm:text-[14px]"
              />
              <button type="button" aria-label="Retirar vídeo" onClick={() => setVideo(null)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-line/60 hover:text-ink">
                <X className="size-4" />
              </button>
            </label>
            {!videoOk && <p className="mt-1.5 text-[13px] text-bad">Use um link do YouTube, do Vimeo ou de um ficheiro de vídeo https (.mp4, .webm).</p>}
          </div>
        )}

        {challenges.length > 0 && (
          <div className="mx-4 mt-3 sm:mx-5">
            <label className="inline-flex max-w-full items-center gap-2 text-[13px] text-muted">
              Desafio
              <select value={challengeId} onChange={(e) => setChallengeId(e.target.value)} className="h-8 max-w-[16rem] min-w-0 truncate rounded-full bg-sunken px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
                <option value="">Nenhum</option>
                {challenges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="mx-4 mt-3 rounded-xl bg-bad-soft px-3 py-2 text-[14px] text-bad sm:mx-5">
            {error.message}
          </p>
        )}

        <div className="mt-3 flex items-center gap-1 border-t border-line/70 px-2 py-2 sm:px-3">
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={photos.length >= MAX_PHOTOS || preparing || pending}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[14px] font-medium text-ink-2 hover:bg-sunken disabled:opacity-40"
          >
            <ImagePlus className="size-5 text-ok" /> <span className="max-sm:sr-only">Fotografias</span>
            {photos.length > 0 && <span className="tabular text-muted">{photos.length}/{MAX_PHOTOS}</span>}
          </button>
          <button
            type="button"
            onClick={() => setVideo((v) => (v === null ? "" : v))}
            disabled={photos.length > 0 || pending}
            title={photos.length ? "Uma publicação tem fotografias ou um vídeo" : undefined}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[14px] font-medium text-ink-2 hover:bg-sunken disabled:opacity-40"
          >
            <Video className="size-5 text-info" /> <span className="max-sm:sr-only">Vídeo</span>
          </button>
          <input ref={picker} type="file" accept="image/*" multiple hidden onChange={choose} />
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={reset} disabled={pending} className={buttonClass("ghost", "md")}>
              Cancelar
            </button>
            <button type="submit" disabled={empty || !videoOk || pending || preparing} className={clsx(buttonClass("primary", "md"), "min-w-24")}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> A publicar…
                </>
              ) : (
                "Publicar"
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
