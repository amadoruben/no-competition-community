"use client";

import { Share2 } from "lucide-react";
import { useCallback, useState } from "react";
import { StoryRing } from "../stories/stories-bar";
import { StoryViewer } from "../stories/story-viewer";
import { seenStories, type ViewerGroup } from "../stories/types";
import { toast } from "../toaster";
import { Avatar, cx } from "../ui";

/** The profile photo; with active stories it gets the ring and opens them. */
export function ProfileAvatar({ name, hue, fileId, group, className }: { name: string; hue: number; fileId: string | null; group: ViewerGroup | null; className?: string }) {
  const seen = seenStories.useIds();
  const [open, setOpen] = useState(false);
  const markSeen = useCallback((id: string) => seenStories.add(id), []);
  const close = useCallback(() => setOpen(false), []);
  const photo = (size: number) => <Avatar name={name} hue={hue} fileId={fileId} size={size} />;
  if (!group)
    return (
      <span className={cx("block rounded-full ring-1 ring-line", className)}>
        <span className="hidden md:block">{photo(150)}</span>
        <span className="md:hidden">{photo(86)}</span>
      </span>
    );
  const fresh = group.slides.some((s) => !seen.has(s.id));
  const first = group.slides.findIndex((s) => !seen.has(s.id));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Ver os stories de ${name}${fresh ? " (novo)" : ""}`} className={cx("block rounded-full", className)}>
        <span className="hidden md:block">
          <StoryRing fresh={fresh} size={162}>
            {photo(150)}
          </StoryRing>
        </span>
        <span className="md:hidden">
          <StoryRing fresh={fresh} size={96}>
            {photo(86)}
          </StoryRing>
        </span>
      </button>
      {open && <StoryViewer groups={[group]} start={{ group: 0, slide: Math.max(0, first) }} onClose={close} onSeen={markSeen} />}
    </>
  );
}

/** Shares the profile with the device's share sheet, or copies its link. */
export function ShareProfile({ path, name, className }: { path: string; name: string; className?: string }) {
  const share = async () => {
    const url = `${location.origin}${path}`;
    try {
      if (navigator.share) return await navigator.share({ title: `${name} · No Competition`, url });
      await navigator.clipboard.writeText(url);
      toast("Link do perfil copiado. Abre para quem tem sessão iniciada na comunidade.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("Não foi possível partilhar.", "bad");
    }
  };
  return (
    <button type="button" onClick={share} className={cx("inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-sunken px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-line", className)}>
      <Share2 className="size-4" /> Partilhar
    </button>
  );
}
