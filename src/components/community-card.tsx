import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { plural } from "@/lib/format";
import type { SocialLinks } from "@/lib/social";
import { BrandMark } from "./brand";
import { CommunityBanner } from "./cover-art";
import { FollowButton } from "./social/follow-button";
import { Avatar } from "./ui";

export type Host = { id: string; name: string; handle: string; headline: string; avatarHue: number; avatarFileId: string | null; links: SocialLinks };

/**
 * The community itself, Skool-style: banner, mark, name, what it is for, the
 * real member count and its host — the person who invites everyone — with
 * "Seguir" until the member follows them.
 */
export function CommunityCard({ members, host, viewerId, followsHost }: { members: number; host: Host | null; viewerId: string; followsHost: boolean }) {
  return (
    <section aria-labelledby="community-title" className="overflow-hidden rounded-[20px] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/80">
      <CommunityBanner className="h-20" />
      <div className="px-4 pb-4">
        <span className="relative -mt-7 block w-fit rounded-[15px] bg-surface p-1">
          <BrandMark size={52} className="rounded-[13px]" />
        </span>
        <h2 id="community-title" className="mt-2 font-display text-[17px] leading-tight font-bold">
          No Competition Community
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">Para quem constrói negócios em África: conteúdos, conversas e desafios com prémios.</p>
        <p className="mt-2 text-[12.5px] text-muted">{plural(members, "membro", "membros")}</p>
        {host && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-gold-strong uppercase">Anfitrião</p>
            <div className="mt-2 flex items-center gap-3">
              <Link href={`/members/${host.handle}`} className="group flex min-w-0 flex-1 items-center gap-2.5">
                <Avatar name={host.name} hue={host.avatarHue} fileId={host.avatarFileId} size={40} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[14px] font-semibold">
                    <span className="truncate group-hover:underline">{host.name}</span>
                    <BadgeCheck aria-label="Conta oficial No Competition" className="size-4 shrink-0 fill-ink text-gold" />
                  </span>
                  <span className="block truncate text-[12px] text-muted">{host.headline || "Equipa No Competition"}</span>
                </span>
              </Link>
            </div>
            {host.id !== viewerId && (
              <div className="mt-3">
                <FollowButton userId={host.id} name={host.name} following={followsHost} links={host.links} size="sm" block />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Phones: the host, until the member follows them (then it goes away). */
export function HostStrip({ host }: { host: Host }) {
  return (
    <section aria-label="Anfitrião da comunidade" className="flex items-center gap-3 rounded-2xl bg-gold-soft p-3 ring-1 ring-gold-line lg:hidden">
      <Link href={`/members/${host.handle}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={host.name} hue={host.avatarHue} fileId={host.avatarFileId} size={44} />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-[0.12em] text-gold-strong uppercase">Anfitrião</span>
          <span className="flex items-center gap-1 text-[14px] font-semibold">
            <span className="truncate group-hover:underline">{host.name}</span>
            <BadgeCheck aria-label="Conta oficial No Competition" className="size-4 shrink-0 fill-ink text-gold" />
          </span>
        </span>
      </Link>
      <FollowButton userId={host.id} name={host.name} following={false} links={host.links} size="sm" />
    </section>
  );
}
