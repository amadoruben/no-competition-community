import { Pin, Play } from "lucide-react";
import Link from "next/link";
import type { Role } from "@/db/schema";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { POST_KIND_LABEL } from "@/lib/labels";
import { SOCIAL_PLATFORM_LABEL, socialSource } from "@/lib/social";
import { videoSource } from "@/lib/video";
import type { FeedItem } from "@/server/community";
import { Avatar, cx } from "../ui";
import { AuthorBadge } from "./author-badge";
import { PostFooter } from "./post-footer";
import { PostMenu } from "./post-menu";

const KIND_MARK: Record<string, string> = { announcement: "📣", question: "❓", progress: "🚀", discussion: "💬", social: "🔗" };

/** Plain text for the preview: no markdown marks, links shortened to their text. */
const plain = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A post in the feed, Skool-style: who and when (with its category), a bold
 * title and two lines of text, a thumbnail on the right when there is a photo
 * or a video, then reactions, comments and the latest people who commented.
 * The whole post — photos, video, thread — opens on its own page.
 */
export function PostRow({ item, viewer }: { item: FeedItem; viewer: { id: string; role: Role } }) {
  const p = item.post;
  const href = `/community/${p.id}`;
  const social = p.kind === "social" ? socialSource(p.videoUrl) : null;
  const text = plain(p.body);
  const heading = p.title || (social ? `Nova publicação no ${SOCIAL_PLATFORM_LABEL[social.platform].replace(" (Twitter)", "")}` : "");
  const label = p.title || `Publicação de ${item.authorName}`;
  const thumb = item.media[0] ? `/files/${item.media[0].fileId}` : (videoSource(p.videoUrl)?.thumbnail ?? null);
  const isVideo = !item.media[0] && !!p.videoUrl;
  const official = p.kind === "announcement";
  const last = item.comments.at(-1);
  const people = [...new Map(item.comments.map((c) => [c.authorHandle, { name: c.authorName, hue: c.authorHue, fileId: c.authorAvatar }])).values()].slice(0, 5);
  const kindLabel = p.kind === "social" ? "Redes" : official ? "Anúncio oficial" : POST_KIND_LABEL[p.kind as keyof typeof POST_KIND_LABEL];

  return (
    <article
      aria-label={label}
      className={cx(
        "rounded-2xl bg-surface px-4 pt-3.5 pb-3 ring-1 transition-shadow hover:shadow-[var(--shadow-card)] sm:px-5 sm:pt-4",
        p.pinned ? "ring-gold-line" : "ring-line/80",
      )}
    >
      <header className="flex items-center gap-3">
        <Link href={`/members/${item.authorHandle}`} tabIndex={-1} aria-hidden className="shrink-0 rounded-full">
          <Avatar name={item.authorName} hue={item.authorHue} fileId={item.authorAvatar} size={38} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <AuthorBadge name={item.authorName} handle={item.authorHandle} role={item.authorRole} className="max-w-full text-[14px]" />
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[12.5px] text-muted">
            <Link href={href} className="hover:text-ink hover:underline">
              <time dateTime={p.createdAt.toISOString()} title={fmtDateTime(p.createdAt)}>
                {timeAgo(p.createdAt)}
              </time>
            </Link>
            {kindLabel && (
              <>
                <span aria-hidden>·</span>
                <span className={cx(official && "font-semibold text-gold-strong")}>
                  <span aria-hidden>{KIND_MARK[p.kind]} </span>
                  <span>{kindLabel}</span>
                </span>
              </>
            )}
          </div>
        </div>
        {p.pinned && (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink">
            <Pin className="size-3.5" /> Fixado
          </span>
        )}
        <PostMenu post={{ id: p.id, kind: p.kind, title: p.title, body: p.body, pinned: p.pinned }} isAuthor={viewer.id === p.authorId} isAdmin={viewer.role === "investor"} inFeed />
      </header>

      <div className="mt-2.5 flex gap-4">
        <div className="min-w-0 flex-1">
          {heading && (
            <h2 className="text-[16.5px] leading-snug font-bold text-ink sm:text-[17px]">
              <Link href={href} className="hover:underline">
                {heading}
              </Link>
            </h2>
          )}
          {text && (
            <Link href={href} className={cx("text-[14.5px] leading-relaxed text-ink-2", heading ? "mt-1 line-clamp-2" : "line-clamp-3")}>
              {text}
            </Link>
          )}
          {(item.challengeTitle || item.projectName) && (
            <p className="mt-1.5 truncate text-[12.5px] text-muted">
              {item.challengeTitle && (
                <Link href={`/challenges/${item.challengeSlug}`} className="hover:text-ink hover:underline">
                  ⚡ {item.challengeTitle}
                </Link>
              )}
              {item.challengeTitle && item.projectName && " · "}
              {item.projectName && (
                <Link href={`/projects/${item.projectSlug}`} className="hover:text-ink hover:underline">
                  {item.projectName}
                </Link>
              )}
            </p>
          )}
        </div>
        {thumb && (
          <Link href={href} tabIndex={-1} aria-hidden className="relative block size-[84px] shrink-0 overflow-hidden rounded-xl bg-sunken ring-1 ring-line sm:size-[96px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
            {isVideo && (
              <span className="absolute inset-0 grid place-items-center bg-ink/15">
                <span className="grid size-8 place-items-center rounded-full bg-ink/80 text-white">
                  <Play className="size-3.5 fill-current" />
                </span>
              </span>
            )}
            {item.media.length > 1 && <span className="absolute right-1 bottom-1 rounded-full bg-ink/75 px-1.5 text-[11px] font-semibold text-white">+{item.media.length - 1}</span>}
          </Link>
        )}
      </div>

      <div className="mt-3">
        <PostFooter
          postId={p.id}
          title={label}
          reactions={item.reactions}
          mine={item.viewerReaction}
          saved={item.viewerSaved}
          comments={item.commentCount}
          shown={0}
          activity={{ people, last: last ? timeAgo(last.c.createdAt) : null }}
        />
      </div>
    </article>
  );
}
