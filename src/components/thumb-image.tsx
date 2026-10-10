"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * Provider thumbnail with its play affordance. If the image cannot load, both
 * disappear and the generated cover underneath is shown on its own.
 */
export function ThumbImage({ src, small }: { src: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- provider thumbnail, no optimisation needed */}
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span aria-hidden className="absolute inset-0 grid place-items-center">
        <span className={`grid place-items-center rounded-full bg-white/90 text-ink shadow-lg backdrop-blur-sm ${small ? "size-7" : "size-11"}`}>
          <Play className={`translate-x-[1px] fill-current ${small ? "size-3" : "size-4"}`} />
        </span>
      </span>
    </>
  );
}
