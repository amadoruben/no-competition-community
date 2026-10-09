import { CalendarClock, MessageCircle, Pin, Users } from "lucide-react";
import Link from "next/link";
import type { ChallengeCard as ChallengeCardData } from "@/server/challenges";
import type { FeedItem } from "@/server/community";
import { challengePhase, PHASE_LABEL, type ChallengePhase } from "@/lib/challenge-state";
import { deadlineText, fmtDay, timeAgo } from "@/lib/format";
import { PHASE_TONE, POST_KIND_LABEL, ROLE_LABEL, STAGE_LABEL } from "@/lib/labels";
import type { Project, ProjectStage, Role } from "@/db/schema";
import { Avatar, Badge, Card, ChallengeCover, cx, ProjectLogo, type Tone } from "./ui";

export { ChallengeCover };
import { ReactionButton } from "./reaction-button";

export function PhaseBadge({ phase }: { phase: ChallengePhase }) {
  return (
    <Badge tone={PHASE_TONE[phase]} dot={phase === "open"}>
      {PHASE_LABEL[phase]}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: ProjectStage }) {
  return <Badge tone="neutral">{STAGE_LABEL[stage]}</Badge>;
}

export function phaseTimeline(c: { startsAt: Date; submissionDeadline: Date; resultsDate: Date }, phase: ChallengePhase) {
  if (phase === "upcoming") return `Abre a ${fmtDay(c.startsAt)}`;
  if (phase === "open") return deadlineText(c.submissionDeadline);
  if (phase === "reviewing") return `Resultados a ${fmtDay(c.resultsDate)}`;
  if (phase === "results") return "Resultados disponíveis";
  if (phase === "paused") return "Temporariamente em pausa";
  return "Não publicado";
}

export function ChallengeCard({ c, href }: { c: ChallengeCardData; href?: string }) {
  const phase = challengePhase(c);
  return (
    <Link href={href ?? `/challenges/${c.slug}`} className="group block focus-visible:rounded-[var(--radius-card)]">
      <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-pop)]">
        <ChallengeCover hue={c.coverHue} className="h-28 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">{c.category}</span>
            <PhaseBadge phase={phase} />
          </div>
          {c.topPrize && (
            <div className="absolute bottom-3 left-4 font-display text-[22px] font-bold text-white drop-shadow-sm">
              {c.topPrize.value}
            </div>
          )}
        </ChallengeCover>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-[18px] leading-snug font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
            {c.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-ink-2">{c.tagline}</p>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[13px] text-muted">
            <span className={cx("flex items-center gap-1.5", phase === "open" && "font-medium text-ink")}>
              <CalendarClock className="size-4" /> {phaseTimeline(c, phase)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4" /> {c.participantCount}
            </span>
            {c.viewerSubmitted ? (
              <Badge tone="ok">Submetido</Badge>
            ) : c.viewerEnrolled ? (
              <Badge tone="info">Inscrito</Badge>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function ProjectCard({
  p,
  meta,
}: {
  p: Pick<Project, "slug" | "name" | "tagline" | "logoHue" | "logoFileId" | "stage" | "category">;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={`/projects/${p.slug}`} className="group block">
      <Card className="flex h-full flex-col p-4 transition-shadow group-hover:shadow-[var(--shadow-pop)]">
        <div className="flex items-start gap-3">
          <ProjectLogo name={p.name} hue={p.logoHue} fileId={p.logoFileId} />
          <div className="min-w-0">
            <h3 className="truncate font-semibold group-hover:underline">{p.name}</h3>
            <div className="mt-0.5 text-[12px] text-muted">{p.category}</div>
          </div>
          <div className="ml-auto">
            <StageBadge stage={p.stage} />
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-ink-2">{p.tagline}</p>
        {meta && <div className="mt-auto pt-3 text-[13px] text-muted">{meta}</div>}
      </Card>
    </Link>
  );
}

export function PersonLine({
  name,
  handle,
  hue,
  fileId,
  sub,
  size = 36,
}: {
  name: string;
  handle: string;
  hue: number;
  fileId?: string | null;
  sub?: React.ReactNode;
  size?: number;
}) {
  return (
    <Link href={`/members/${handle}`} className="group flex min-w-0 items-center gap-3">
      <Avatar name={name} hue={hue} fileId={fileId} size={size} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium group-hover:underline">{name}</div>
        {sub && <div className="truncate text-[12px] text-muted">{sub}</div>}
      </div>
    </Link>
  );
}

const KIND_TONE: Record<string, Tone> = { announcement: "dark", discussion: "neutral", progress: "ok", question: "info" };

export function RoleTag({ role }: { role: Role }) {
  if (role === "member") return null;
  return <Badge tone={role === "investor" ? "volt" : "violet"} className="h-5 px-2 text-[11px]">{ROLE_LABEL[role]}</Badge>;
}

export function PostCard({ item, compact, full }: { item: FeedItem; compact?: boolean; full?: boolean }) {
  const p = item.post;
  return (
    <Card className={cx("p-4 sm:p-5", p.kind === "announcement" && "ring-ink/15")}>
      <div className="flex items-start gap-3">
        <Avatar name={item.authorName} hue={item.authorHue} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <Link href={`/members/${item.authorHandle}`} className="font-medium text-ink hover:underline">
              {item.authorName}
            </Link>
            <RoleTag role={item.authorRole} />
            <span className="text-muted">· {timeAgo(p.createdAt)}</span>
            {p.pinned && (
              <span className="flex items-center gap-1 text-muted">
                · <Pin className="size-3.5" /> Fixado
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={KIND_TONE[p.kind]} className="h-5 px-2 text-[11px]">
              {POST_KIND_LABEL[p.kind]}
            </Badge>
            {item.challengeTitle && (
              <Link href={`/challenges/${item.challengeSlug}`} className="text-[12px] font-medium text-muted hover:text-ink">
                em {item.challengeTitle}
              </Link>
            )}
            {item.projectName && (
              <Link href={`/projects/${item.projectSlug}`} className="text-[12px] font-medium text-muted hover:text-ink">
                · {item.projectName}
              </Link>
            )}
          </div>
          <Link href={`/community/${p.id}`} className="group mt-2 block">
            <h3 className="text-[16px] leading-snug font-semibold group-hover:underline">{p.title}</h3>
            <p className={cx("mt-1 text-[14px] whitespace-pre-line text-ink-2", full ? "" : compact ? "line-clamp-2" : "line-clamp-4")}>{p.body}</p>
          </Link>
          <div className="mt-3 flex items-center gap-1">
            <ReactionButton postId={p.id} count={item.reactionCount} active={item.viewerReacted} />
            <Link href={`/community/${p.id}`} className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-muted hover:bg-sunken hover:text-ink">
              <MessageCircle className="size-4" /> {item.commentCount}
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  if (score === null) return <span className={cx("tabular text-sm text-faint", className)}>—</span>;
  const tone = score >= 80 ? "bg-ok-soft text-ok" : score >= 65 ? "bg-volt-soft text-ink" : score >= 50 ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad";
  return (
    <span className={cx("tabular inline-flex h-7 min-w-12 items-center justify-center rounded-lg px-2 text-sm font-semibold", tone, className)}>
      {score.toFixed(1).replace(".", ",")}
    </span>
  );
}

export function RankMedal({ rank }: { rank: number }) {
  const style =
    rank === 1 ? "bg-volt text-ink" : rank === 2 ? "bg-ink text-white" : rank === 3 ? "bg-sunken text-ink ring-1 ring-line-strong" : "bg-transparent text-muted";
  return (
    <span className={cx("tabular inline-grid size-8 shrink-0 place-items-center rounded-full font-mono text-[13px] font-semibold", style)}>
      {rank}
    </span>
  );
}

/** Dense one-line post entry for sidebars. */
export function PostRow({ item }: { item: FeedItem }) {
  return (
    <Link href={`/community/${item.post.id}`} className="group flex gap-3 px-5 py-3 hover:bg-sunken/50">
      <Avatar name={item.authorName} hue={item.authorHue} size={30} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm leading-snug font-medium group-hover:underline">{item.post.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
          <span className="truncate">{item.authorName.split(" ")[0]}</span>
          <span>· {timeAgo(item.post.createdAt)}</span>
          <span className="flex items-center gap-0.5">· <MessageCircle className="size-3" /> {item.commentCount}</span>
        </div>
      </div>
    </Link>
  );
}
