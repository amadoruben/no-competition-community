import { ArrowUpRight } from "lucide-react";
import { SOCIAL_PLATFORM_LABEL, socialSource } from "@/lib/social";
import { VideoEmbed } from "../feed/video-embed";
import { cx, fileUrl } from "../ui";
import { PlatformTile } from "./platform-icon";

/**
 * A publication from a social network, as the team shared it: YouTube plays
 * in its official privacy-enhanced player (only after a tap); Instagram,
 * TikTok and X show the cover the team uploaded and open the original.
 */
export function SocialMedia({ url, title, cover, className }: { url: string; title: string; cover?: { fileId: string } | null; className?: string }) {
  const src = socialSource(url);
  if (!src) return null;
  if (src.platform === "youtube") return <VideoEmbed url={src.url} title={title} />;
  const label = SOCIAL_PLATFORM_LABEL[src.platform].replace(" (Twitter)", "");
  return (
    <a href={src.url} target="_blank" rel="noopener noreferrer" className={cx("group relative block overflow-hidden bg-mist", className)} aria-label={`Ver no ${label}: ${title}`}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- cover uploaded by the team, served by /files
        <img src={fileUrl(cover.fileId)} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.015]" />
      ) : (
        <span className="grid aspect-[16/10] place-items-center">
          <PlatformTile platform={src.platform} size={72} />
        </span>
      )}
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 py-1 pr-3 pl-1 text-[12px] font-semibold text-white backdrop-blur">
        <PlatformTile platform={src.platform} size={22} className="!rounded-full" />
        {label}
      </span>
    </a>
  );
}

/** "Ver publicação original no …": the way out to the network, under the post. */
export function OriginalLink({ url, className }: { url: string; className?: string }) {
  const src = socialSource(url);
  if (!src) return null;
  const label = SOCIAL_PLATFORM_LABEL[src.platform].replace(" (Twitter)", "");
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cx("flex items-center justify-between gap-3 rounded-xl bg-mist px-3.5 py-2.5 text-[14px] font-semibold text-ink ring-1 ring-line transition hover:bg-sunken", className)}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <PlatformTile platform={src.platform} size={26} />
        <span className="truncate">Ver publicação original no {label}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0" />
      <span className="sr-only">(abre noutro separador)</span>
    </a>
  );
}
