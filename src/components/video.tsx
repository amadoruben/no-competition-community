import { Lock, PlayCircle } from "lucide-react";
import { videoSource } from "@/lib/video";
import { ThumbImage } from "./thumb-image";
import { cx } from "./ui";

/** 16:9 player for the providers `videoSource` accepts; nothing else is ever embedded. */
export function VideoPlayer({ url, title }: { url: string | null; title: string }) {
  const src = videoSource(url);
  if (!src) return null;
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink">
      {src.kind === "file" ? (
        <video src={src.src} controls preload="metadata" playsInline className="size-full" title={title} />
      ) : (
        <iframe
          src={src.embed}
          title={title}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}

/** Thumbnail for a collection or video: the provider image when available, otherwise the brand cover. */
export function VideoThumb({ thumbnail, hue, locked, className }: { thumbnail: string | null; hue: number; locked?: boolean; className?: string }) {
  return (
    <div className={cx("cover relative grid aspect-video place-items-center overflow-hidden", className)} style={{ ["--h" as string]: hue }}>
      {thumbnail && <ThumbImage src={thumbnail} />}
      <span className={cx("relative grid size-11 place-items-center rounded-full backdrop-blur", locked ? "bg-ink/70 text-white" : "bg-white/85 text-ink")}>
        {locked ? <Lock className="size-5" /> : <PlayCircle className="size-6" />}
      </span>
    </div>
  );
}
