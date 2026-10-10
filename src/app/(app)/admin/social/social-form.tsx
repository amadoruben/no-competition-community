"use client";

import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { createSocialAction, deletePostAction, updateSocialAction } from "@/app/actions";
import { Dialog } from "@/components/overlay";
import { PlatformTile } from "@/components/social/platform-icon";
import { toast } from "@/components/toaster";
import { buttonClass, fileUrl } from "@/components/ui";
import { preparePhoto, type Photo } from "@/lib/client/photo";
import { SOCIAL_PLATFORM_LABEL, socialSource } from "@/lib/social";

type Existing = { id: string; url: string; title: string; caption: string; cover: { fileId: string } | null };

/**
 * Adds (or edits) a publication from a social network: the link, a title and
 * caption written by the team, and a cover photo. The platform and creator are
 * read from the link as it is typed; nothing is fetched from the network.
 */
export function SocialForm({ existing, onDone }: { existing?: Existing; onDone?: () => void }) {
  const router = useRouter();
  const id = useId();
  const [url, setUrl] = useState(existing?.url ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [caption, setCaption] = useState(existing?.caption ?? "");
  const [cover, setCover] = useState<Photo | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const src = socialSource(url);

  useEffect(
    () => () => {
      if (cover) URL.revokeObjectURL(cover.url);
    },
    [cover],
  );

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      setCover(await preparePhoto(file));
      setRemoveCover(false);
    } catch {
      setError("Não foi possível ler esta imagem. Experimente outra.");
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData();
    fd.set("url", url);
    fd.set("title", title);
    fd.set("caption", caption);
    if (cover) fd.set("cover", cover.blob, "capa.jpg");
    if (removeCover) fd.set("removeCover", "1");
    start(async () => {
      const r = existing ? await updateSocialAction(existing.id, null, fd) : await createSocialAction(null, fd);
      if (r?.ok) {
        toast(existing ? "Publicação actualizada." : "Publicação partilhada na comunidade.");
        setErrors({});
        setError(null);
        if (!existing) {
          setUrl("");
          setTitle("");
          setCaption("");
          setCover(null);
        }
        router.refresh();
        onDone?.();
      } else {
        setErrors(r?.fieldErrors ?? {});
        setError(r?.error ?? "Não foi possível guardar.");
      }
    });
  };

  const currentCover = cover ? cover.url : !removeCover && existing?.cover ? fileUrl(existing.cover.fileId) : null;
  const control = "w-full rounded-xl bg-surface px-3.5 text-[16px] ring-1 ring-line-strong ring-inset placeholder:text-muted focus:ring-2 focus:ring-gold-strong focus:outline-none sm:text-[15px]";
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-url`} className="block text-[13px] font-medium">
          Link da publicação
        </label>
        <input
          id={`${id}-url`}
          name="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://www.instagram.com/reel/…"
          aria-invalid={!!errors.url || undefined}
          aria-describedby={`${id}-url-help`}
          className={`${control} h-11`}
        />
        <p id={`${id}-url-help`} className="flex items-center gap-2 text-[13px] text-muted">
          {src ? (
            <>
              <PlatformTile platform={src.platform} size={20} />
              <span>
                {SOCIAL_PLATFORM_LABEL[src.platform]}
                {src.creator ? ` · @${src.creator}` : " · o criador não consta do link"}
              </span>
            </>
          ) : errors.url ? (
            <span className="font-medium text-bad">{errors.url}</span>
          ) : (
            "Instagram, TikTok, YouTube ou X. Só o link é guardado."
          )}
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-title`} className="block text-[13px] font-medium">
          Título (opcional)
        </label>
        <input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className={`${control} h-11`} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-caption`} className="block text-[13px] font-medium">
          Legenda (opcional)
        </label>
        <textarea id={`${id}-caption`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} rows={4} className={`${control} py-2.5 leading-relaxed`} />
        <p className="text-[12.5px] text-muted">Escreva com as suas palavras. Não copie aqui textos de outras pessoas sem autorização.</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">Capa {src?.platform === "youtube" ? "(opcional: o YouTube já tem miniatura)" : "(recomendada)"}</p>
        <div className="flex items-center gap-3">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-sunken ring-1 ring-line">
            {currentCover ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview or /files URL
              <img src={currentCover} alt="Capa" className="size-full object-cover" />
            ) : src ? (
              <PlatformTile platform={src.platform} size={36} />
            ) : (
              <ImagePlus className="size-6 text-muted" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label htmlFor={`${id}-cover`} className={buttonClass("secondary", "sm", "cursor-pointer")}>
              <ImagePlus className="size-4" /> {currentCover ? "Trocar capa" : "Escolher capa"}
            </label>
            <input id={`${id}-cover`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
            {currentCover && (
              <button type="button" onClick={() => (setCover(null), setRemoveCover(true))} className={buttonClass("ghost", "sm")}>
                <X className="size-4" /> Remover
              </button>
            )}
          </div>
        </div>
        <p className="text-[12.5px] text-muted">Use uma imagem da própria publicação ou que tenha direito a usar. Fica visível também na página pública.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" onClick={onDone} className={buttonClass("secondary")}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={pending} className={buttonClass("accent", "md", "font-semibold")}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {existing ? "Guardar" : "Partilhar na comunidade"}
        </button>
      </div>
    </form>
  );
}

/** Edit and remove buttons for one shared publication. */
export function SocialItemActions({ item, startOpen }: { item: Existing; startOpen?: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(!!startOpen);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      const r = await deletePostAction(item.id);
      setConfirm(false);
      if (!r.ok) return toast(r.error ?? "Não foi possível remover.", "bad");
      toast("Publicação removida.");
      router.refresh();
    });
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setEdit(true)} className={buttonClass("ghost", "sm")}>
        Editar
      </button>
      <button type="button" onClick={() => setConfirm(true)} aria-label={`Remover ${item.title || "publicação"}`} className={buttonClass("ghost", "sm", "text-bad")}>
        <Trash2 className="size-4" />
      </button>
      <Dialog open={edit} onClose={() => setEdit(false)} title="Editar publicação partilhada" size="lg">
        <SocialForm existing={item} onDone={() => setEdit(false)} />
      </Dialog>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Remover da comunidade?"
        description="Deixa de aparecer no Início e na página pública, com os comentários e reacções. A publicação original na rede social não é afectada."
        size="sm"
        footer={
          <>
            <button type="button" className={buttonClass("secondary")} onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button type="button" className={buttonClass("danger")} disabled={pending} onClick={remove}>
              Remover
            </button>
          </>
        }
      />
    </div>
  );
}
