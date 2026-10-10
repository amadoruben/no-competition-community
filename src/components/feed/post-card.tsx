import { FolderKanban, Megaphone, Pin, Zap } from "lucide-react";
import Link from "next/link";
import type { Role } from "@/db/schema";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { POST_KIND_LABEL } from "@/lib/labels";
import type { FeedItem } from "@/server/community";
import { Avatar, cx } from "../ui";
import { AuthorBadge } from "./author-badge";
import { Expandable } from "./expandable";
import { Gallery } from "./gallery";
import { PostFooter } from "./post-footer";
import { PostMenu } from "./post-menu";
import { RichText } from "./rich-text";
import { VideoEmbed } from "./video-embed";

/**
 * A post as members see it: author, time and type; text with links; photos or
 * a video; then reactions, comments, sharing and saving. In the feed long text
 * folds and the latest comments show under the post; `full` is the post page.
 */
export function PostCard({ item, viewer, full }: { item: FeedItem; viewer: { id: string; role: Role }; full?: boolean }) {
  const p = item.post;
  const official = p.kind === "announcement";
  const label = p.title || `Publicação de ${item.authorName}`;
  const hasMedia = item.media.length > 0 || !!p.videoUrl;
  return (
    <article
      aria-label={label}
      className={cx(
        "-mx-4 border-y border-line/80 bg-surface sm:mx-0 sm:overflow-hidden sm:rounded-[20px] sm:border-0 sm:shadow-[var(--shadow-card)] sm:ring-1",
        official ? "sm:ring-ink/20" : "sm:ring-line/80",
      )}
    >
      {(official || p.pinned) && (
        <div className={cx("flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold sm:px-5", official ? "bg-ink text-white" : "border-b border-line/70 text-ink-2")}>
          {official ? <Megaphone className="size-3.5 text-volt" /> : <Pin className="size-3.5" />}
          <span>{official ? "Anúncio oficial" : "Fixado pela equipa No Competition"}</span>
          {official && p.pinned && (
            <span className="ml-auto inline-flex items-center gap-1 font-medium text-white/70">
              <Pin className="size-3" /> Fixado
            </span>
          )}
        </div>
      )}
      <header className="flex items-center gap-3 px-4 pt-3.5 sm:px-5 sm:pt-4">
        <Link href={`/members/${item.authorHandle}`} tabIndex={-1} aria-hidden className="shrink-0 rounded-full">
          <Avatar name={item.authorName} hue={item.authorHue} fileId={item.authorAvatar} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <AuthorBadge name={item.authorName} handle={item.authorHandle} role={item.authorRole} className="max-w-full text-[14.5px]" />
          <div className="mt-px flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">
            <Link href={`/community/${p.id}`} className="hover:text-ink hover:underline">
              <time dateTime={p.createdAt.toISOString()} title={fmtDateTime(p.createdAt)}>
                {timeAgo(p.createdAt)}
              </time>
            </Link>
            {(p.kind === "question" || p.kind === "progress") && (
              <>
                <span aria-hidden>·</span>
                <span className={cx("font-medium", p.kind === "question" ? "text-info" : "text-ok")}>{POST_KIND_LABEL[p.kind]}</span>
              </>
            )}
            {p.editedAt && (
              <>
                <span aria-hidden>·</span>
                <span title={`Editado ${fmtDateTime(p.editedAt)}`}>editado</span>
              </>
            )}
          </div>
        </div>
        <PostMenu post={{ id: p.id, kind: p.kind, title: p.title, body: p.body, pinned: p.pinned }} isAuthor={viewer.id === p.authorId} isAdmin={viewer.role === "investor"} inFeed={!full} />
      </header>

      {(p.title || p.body) && (
        <div className="px-4 pt-2.5 text-[15px] leading-relaxed sm:px-5">
          {p.title &&
            (full ? (
              <h1 className="font-display text-[22px] leading-snug font-semibold text-ink sm:text-[26px]">{p.title}</h1>
            ) : (
              <h2 className="text-[16px] leading-snug font-semibold text-ink">
                <Link href={`/community/${p.id}`} className="hover:underline">
                  {p.title}
                </Link>
              </h2>
            ))}
          {p.body &&
            (full ? (
              <RichText text={p.body} className="mt-2 text-ink-2" />
            ) : (
              <div className={cx("text-ink-2", p.title && "mt-1")}>
                <Expandable lines={hasMedia ? 3 : 5}>
                  <RichText text={p.body} flow />
                </Expandable>
              </div>
            ))}
        </div>
      )}

      {(item.challengeTitle || item.projectName) && (
        <div className="flex flex-wrap gap-2 px-4 pt-3 sm:px-5">
          {item.challengeTitle && (
            <Link href={`/challenges/${item.challengeSlug}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-[12.5px] font-medium text-ink-2 hover:text-ink">
              <Zap className="size-3.5 shrink-0" /> <span className="truncate">{item.challengeTitle}</span>
            </Link>
          )}
          {item.projectName && (
            <Link href={`/projects/${item.projectSlug}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-[12.5px] font-medium text-ink-2 hover:text-ink">
              <FolderKanban className="size-3.5 shrink-0" /> <span className="truncate">{item.projectName}</span>
            </Link>
          )}
        </div>
      )}

      {item.media.length > 0 && (
        <div className="mt-3">
          <Gallery photos={item.media} label={label} />
        </div>
      )}
      {p.videoUrl && (
        <div className="mt-3">
          <VideoEmbed url={p.videoUrl} title={label} />
        </div>
      )}

      <div className={hasMedia ? "pt-1" : "pt-2"}>
        <PostFooter
          postId={p.id}
          title={label}
          reactions={item.reactionCount}
          reacted={item.viewerReacted}
          saved={item.viewerSaved}
          comments={item.commentCount}
          shown={full ? item.commentCount : item.comments.length}
          inlineComment={!full}
        >
          {!full && item.comments.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {item.comments.map((c) => (
                <li key={c.c.id} className="line-clamp-2 text-[14px] leading-snug">
                  <Link href={`/members/${c.authorHandle}`} className="font-semibold text-ink hover:underline">
                    {c.authorName}
                  </Link>{" "}
                  <span className="text-ink-2">{c.c.body}</span>
                </li>
              ))}
            </ul>
          )}
        </PostFooter>
      </div>
    </article>
  );
}
