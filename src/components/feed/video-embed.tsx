"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { videoSource } from "@/lib/video";

/**
 * A linked video in a post. The provider's player loads only when the member
 * presses play, so a feed full of videos stays light and sends nothing to
 * YouTube or Vimeo until then.
 */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const src = videoSource(url);
  if (!src) return null;
  if (src.kind === "file")
    return (
      <div className="aspect-video bg-ink">
        <video src={src.src} controls preload="metadata" playsInline className="size-full" title={title} />
      </div>
    );
  if (playing)
    return (
      <div className="relative aspect-video bg-ink">
        <iframe
          src={`${src.embed}${src.embed.includes("?") ? "&" : "?"}autoplay=1`}
          title={title}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  return (
    <button type="button" onClick={() => setPlaying(true)} className="group/video relative block aspect-video w-full overflow-hidden bg-ink text-left" aria-label={`Ver vídeo: ${title}`}>
      {src.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element -- provider thumbnail, shown only for links the author posted
        <img src={src.thumbnail} alt="" loading="lazy" className="size-full object-cover opacity-90 transition group-hover/video:opacity-100" onError={(e) => (e.currentTarget.style.display = "none")} />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-16 place-items-center rounded-full bg-white/95 text-ink shadow-[var(--shadow-pop)] transition group-hover/video:scale-105">
          <Play className="ml-1 size-7 fill-current" />
        </span>
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">{src.kind === "youtube" ? "YouTube" : "Vimeo"}</span>
    </button>
  );
}
