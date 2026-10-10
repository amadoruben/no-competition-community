"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useRef, useState } from "react";

type Photo = { fileId: string; width: number; height: number };

/** Portrait no taller than 4:5, landscape no wider than 1.91:1 — the proportions a feed reads well in. */
export const clampRatio = (w: number, h: number) => Math.min(1.91, Math.max(0.8, w / h));

function Img({ p, label, eager }: { p: Photo; label: string; eager?: boolean }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  return (
    <div className={clsx("relative size-full bg-sunken", state === "loading" && "animate-pulse")}>
      {state === "error" ? (
        <div className="grid size-full place-items-center text-muted">
          <span className="flex flex-col items-center gap-2 text-[13px]">
            <ImageOff className="size-6" /> Imagem indisponível
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- auth-gated /files URL; see Avatar
        <img
          src={`/files/${p.fileId}`}
          alt={label}
          width={p.width}
          height={p.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className="size-full object-cover"
        />
      )}
    </div>
  );
}

/**
 * Photos of a post. One photo keeps its proportions (within the feed's
 * limits); several become a swipeable row with arrows, a counter and dots.
 * The row scrolls natively, so touch, trackpad and keyboard all work.
 */
export function Gallery({ photos, label }: { photos: Photo[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const ratio = clampRatio(photos[0].width, photos[0].height);
  if (photos.length === 1)
    return (
      <div className="overflow-hidden bg-sunken" style={{ aspectRatio: ratio }}>
        <Img p={photos[0]} label={label} />
      </div>
    );
  const go = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="group/gallery relative" role="group" aria-roledescription="galeria" aria-label={`${label}: ${photos.length} fotografias`}>
      <div
        ref={track}
        tabIndex={0}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-sunken focus-visible:outline-offset-[-3px]"
        style={{ aspectRatio: ratio }}
      >
        {photos.map((p, i) => (
          <div key={p.fileId} className="h-full w-full shrink-0 snap-center" aria-hidden={i !== index}>
            <Img p={p} label={`${label} — fotografia ${i + 1} de ${photos.length}`} eager={i === 0} />
          </div>
        ))}
      </div>
      <span className="tabular pointer-events-none absolute top-3 right-3 rounded-full bg-ink/70 px-2 py-0.5 text-[12px] font-medium text-white backdrop-blur">
        {index + 1}/{photos.length}
      </span>
      {(
        [
          [-1, ChevronLeft, "Fotografia anterior", "left-2"],
          [1, ChevronRight, "Fotografia seguinte", "right-2"],
        ] as const
      ).map(([d, Icon, name, side]) => {
        const hidden = d < 0 ? index === 0 : index === photos.length - 1;
        return (
          <button
            key={d}
            type="button"
            aria-label={name}
            disabled={hidden}
            onClick={() => go(index + d)}
            className={clsx(
              "absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-[var(--shadow-pop)] transition-opacity",
              side,
              hidden ? "pointer-events-none opacity-0" : "opacity-0 group-hover/gallery:opacity-100 focus-visible:opacity-100 max-sm:hidden",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
      <div aria-hidden className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
        {photos.map((p, i) => (
          <span key={p.fileId} className={clsx("size-1.5 rounded-full transition-colors", i === index ? "bg-white" : "bg-white/45")} />
        ))}
      </div>
    </div>
  );
}
