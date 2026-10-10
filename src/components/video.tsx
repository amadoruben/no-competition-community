import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { CoverArt, glyphFor } from "./cover-art";
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

/**
 * Thumbnail for a collection or video: the provider image when the server sent
 * one (never for locked content), otherwise generated cover art for the theme.
 */
export function VideoThumb({
  thumbnail,
  hue,
  seed,
  theme,
  locked,
  done,
  duration,
  small,
  number,
  className,
}: {
  thumbnail: string | null;
  hue: number;
  seed?: string;
  theme?: string;
  locked?: boolean;
  done?: boolean;
  /** Minutes, shown as a corner badge. */
  duration?: number;
  small?: boolean;
  /** Position in the collection, printed on the generated cover (the real thumbnail covers it). */
  number?: number;
  className?: string;
}) {
  return (
    <CoverArt hue={hue} seed={seed ?? String(hue)} glyph={glyphFor(theme)} className={cx("aspect-video", className)}>
      {number !== undefined && !small && (
        <span aria-hidden className="tabular absolute bottom-2 left-3 font-display text-[34px] leading-none font-semibold text-white/85">
          {String(number).padStart(2, "0")}
        </span>
      )}
      {thumbnail && !locked && <ThumbImage src={thumbnail} small={small} />}
      {locked && (
        <span className="absolute inset-0 grid place-items-center bg-ink/35">
          <span className={cx("grid place-items-center rounded-full bg-ink/80 text-white backdrop-blur-sm", small ? "size-7" : "size-11")}>
            <Lock className={small ? "size-3.5" : "size-5"} />
          </span>
        </span>
      )}
      {duration !== undefined && !small && (
        <span className="tabular absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">{duration} min</span>
      )}
      {done && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-ok px-1.5 py-0.5 text-[11px] font-semibold text-white">
          <Check className="size-3" strokeWidth={3} /> Visto
        </span>
      )}
    </CoverArt>
  );
}

/** A video in a row or grid: thumbnail with duration, then the title. */
export function VideoCard({
  href,
  title,
  thumbnail,
  hue,
  seed,
  theme,
  duration,
  done,
  eyebrow,
  number,
}: {
  href: string;
  title: string;
  thumbnail: string | null;
  hue: number;
  seed: string;
  theme?: string;
  duration: number;
  done?: boolean;
  eyebrow?: string;
  number?: number;
}) {
  return (
    <Link href={href} className="group block h-full rounded-[var(--radius-card)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/80 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-pop)]">
        <VideoThumb thumbnail={thumbnail} hue={hue} seed={seed} theme={theme} duration={duration} done={done} number={number} />
        <div className="p-3.5">
          {/* The generated cover already prints the number; a real thumbnail does not. */}
          {eyebrow && (thumbnail || number === undefined) && <div className="mb-0.5 truncate text-[12px] text-muted">{eyebrow}</div>}
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold group-hover:underline">{title}</h3>
        </div>
      </div>
    </Link>
  );
}
