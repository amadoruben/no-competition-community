"use client";

import { useState } from "react";

/** Provider thumbnail that disappears (leaving the brand cover) if it cannot load. */
export function ThumbImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- provider thumbnail, no optimisation needed
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />;
}
