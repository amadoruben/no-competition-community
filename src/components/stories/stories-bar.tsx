"use client";

import { BadgeCheck, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { BrandMark } from "../brand";
import { Avatar, cx } from "../ui";
import { StoryComposer } from "./story-composer";
import { StoryViewer } from "./story-viewer";
import { seenStories, type ViewerGroup } from "./types";

/** Gold ring for new stories, a quiet grey one once everything was watched. */
export function StoryRing({
  fresh,
  size,
  children,
}: {
  fresh: boolean;
  size: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-full",
        fresh
          ? "bg-[conic-gradient(from_210deg,#f0d796,#c39b4a,#80611f,#c39b4a,#f0d796)]"
          : "bg-line-strong",
      )}
      style={{ width: size, height: size, padding: fresh ? 2.5 : 1.5 }}
    >
      <span className="grid size-full place-items-center rounded-full bg-surface p-[2px]">
        {children}
      </span>
    </span>
  );
}

/**
 * The stories bar at the top of Início: the community's weekly news and the
 * team's stories (the team also sees its own, with the button to add one).
 * Which stories were watched is remembered on this device only.
 */
export function StoriesBar({
  groups,
  me,
  canPost,
}: {
  groups: ViewerGroup[];
  me: { name: string; hue: number; fileId: string | null };
  /** The team publishes stories; members watch them. */
  canPost: boolean;
}) {
  const seen = seenStories.useIds();
  const [open, setOpen] = useState<{ group: number; slide: number } | null>(
    null,
  );
  const [composer, setComposer] = useState(false);

  const markSeen = useCallback((id: string) => seenStories.add(id), []);
  const close = useCallback(() => setOpen(null), []);

  const play = (index: number) => {
    const first = groups[index].slides.findIndex((s) => !seen.has(s.id));
    setOpen({ group: index, slide: first < 0 ? 0 : first });
  };
  const ownIndex = groups.findIndex((g) => g.own);
  const plus =
    "absolute right-0 bottom-0 grid size-6 place-items-center rounded-full bg-ink text-white ring-[3px] ring-surface";
  const fresh = (g: ViewerGroup) => g.slides.some((s) => !seen.has(s.id));

  return (
    <section aria-label="Stories" className="-mx-4 sm:mx-0">
      <ul className="scrollbar-none flex gap-3.5 overflow-x-auto px-4 pt-1 pb-2 sm:gap-4 sm:px-1">
        {canPost && (
          <li className="w-[76px] shrink-0">
            <div className="relative mx-auto w-fit">
              {ownIndex >= 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => play(ownIndex)}
                    aria-label="Ver o seu story"
                    className="block rounded-full"
                  >
                    <StoryRing fresh={fresh(groups[ownIndex])} size={72}>
                      <Avatar
                        name={me.name}
                        hue={me.hue}
                        fileId={me.fileId}
                        size={62}
                      />
                    </StoryRing>
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposer(true)}
                    aria-label="Adicionar outro story"
                    className={plus}
                  >
                    <Plus className="size-3.5" strokeWidth={3} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setComposer(true)}
                  aria-label="Criar um story"
                  className="relative block rounded-full"
                >
                  <span className="grid size-[72px] place-items-center rounded-full p-[4px]">
                    <Avatar
                      name={me.name}
                      hue={me.hue}
                      fileId={me.fileId}
                      size={62}
                    />
                  </span>
                  <span aria-hidden className={plus}>
                    <Plus className="size-3.5" strokeWidth={3} />
                  </span>
                </button>
              )}
            </div>
            <p className="mt-1 truncate text-center text-[12px] text-ink-2">
              O seu story
            </p>
          </li>
        )}
        {groups.map((g, i) =>
          g.own ? null : (
            <li key={g.key} className="w-[76px] shrink-0">
              <button
                type="button"
                onClick={() => play(i)}
                aria-label={`${g.key === "digest" ? "Ver as novidades da semana" : `Ver os stories de ${g.name}`}${fresh(g) ? " (novo)" : ""}`}
                className="group block w-full"
              >
                <span className="mx-auto block w-fit">
                  <StoryRing fresh={fresh(g)} size={72}>
                    {g.avatar.kind === "brand" ? (
                      <BrandMark size={62} className="rounded-full" />
                    ) : (
                      <Avatar
                        name={g.name}
                        hue={g.avatar.hue}
                        fileId={g.avatar.fileId}
                        size={62}
                      />
                    )}
                  </StoryRing>
                </span>
                <span className="mt-1 flex items-center justify-center gap-0.5 text-[12px] text-ink">
                  <span className="truncate">
                    {g.key === "digest" ? "Novidades" : g.name.split(" ")[0]}
                  </span>
                  {g.official && (
                    <BadgeCheck
                      aria-hidden
                      className="size-3.5 shrink-0 fill-ink text-gold"
                    />
                  )}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {open && (
        <StoryViewer
          groups={groups}
          start={open}
          onClose={close}
          onSeen={markSeen}
        />
      )}
      {canPost && (
        <StoryComposer open={composer} onClose={() => setComposer(false)} />
      )}
    </section>
  );
}
