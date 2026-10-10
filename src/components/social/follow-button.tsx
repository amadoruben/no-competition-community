"use client";

import clsx from "clsx";
import { ArrowUpRight, Check, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { followAction } from "@/app/actions";
import { profileHandle, SOCIAL_PLATFORM_LABEL, SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/social";
import { Dialog } from "../overlay";
import { toast } from "../toaster";
import { buttonClass } from "../ui";
import { PlatformTile } from "./platform-icon";

/**
 * "Seguir nas redes" — for people with social networks on their profile (the
 * community's host above all). It opens a panel with their networks: the
 * member opens the ones they want and confirms — "Já sigo" if they already
 * follow, "Concluído" once they opened at least one. Only that confirmation
 * is recorded: the networks do not let anyone verify who follows whom, so
 * nothing here claims to. "Agora não" records nothing. Members do not follow
 * each other inside the community: this is not a social network.
 */
export function FollowButton({
  userId,
  name,
  following,
  links,
  size = "md",
  block,
  onChange,
}: {
  userId: string;
  name: string;
  following: boolean;
  links?: SocialLinks;
  size?: "sm" | "md";
  block?: boolean;
  onChange?: (state: { following: boolean; followers: number }) => void;
}) {
  const [base, setBase] = useState(following);
  const [on, setOn] = useState(following);
  if (base !== following) {
    setBase(following);
    setOn(following);
  }
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState(false);
  const hasNetworks = SOCIAL_PLATFORMS.some((p) => links?.[p]);
  const first = name.split(" ")[0];

  const save = (next: boolean, done?: () => void) => {
    if (pending) return;
    const prev = on;
    setOn(next);
    start(async () => {
      const r = await followAction(userId, next);
      if (r.ok) {
        setOn(!!r.following);
        onChange?.({ following: !!r.following, followers: r.followers ?? 0 });
        done?.();
      } else {
        setOn(prev);
        toast(r.error ?? "Não foi possível concluir.", "bad");
      }
    });
  };

  if (!hasNetworks) return null;
  const h = size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-5 text-[14px]";
  return (
    <>
      {on ? (
        <button
          type="button"
          onClick={() => setPanel(true)}
          aria-label={`Já segue ${name} nas redes`}
          className={clsx("inline-flex items-center justify-center gap-1.5 rounded-full bg-sunken font-semibold text-ink transition-colors hover:bg-line", h, block && "w-full")}
        >
          <Check className="size-4" strokeWidth={2.6} /> Já segue nas redes
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setPanel(true)}
          aria-label={`Seguir ${name} nas redes`}
          className={clsx(
            "inline-flex items-center justify-center gap-1.5 rounded-full bg-gold font-semibold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-colors hover:bg-gold-hover disabled:opacity-60",
            h,
            block && "w-full",
          )}
        >
          <UserPlus className="size-4" /> Seguir nas redes
        </button>
      )}
      <SocialPanel
        open={panel}
        onClose={() => setPanel(false)}
        name={name}
        links={links!}
        following={on}
        pending={pending}
        onConfirm={() => save(true, () => (setPanel(false), toast(`Obrigado! Fica registado que segue ${first} nas redes.`)))}
        onUnfollow={() => save(false, () => setPanel(false))}
      />
    </>
  );
}

/**
 * The person's networks, each opening in a new tab. Following: the member
 * confirms at the end. Already following: the same list, and the option to stop.
 */
export function SocialPanel({
  open,
  onClose,
  name,
  links,
  following,
  pending,
  onConfirm,
  onUnfollow,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  links: SocialLinks;
  following?: boolean;
  pending?: boolean;
  /** Absent when the panel only shows the networks (e.g. on the landing page). */
  onConfirm?: () => void;
  onUnfollow?: () => void;
}) {
  const [opened, setOpened] = useState<string[]>([]);
  const networks = SOCIAL_PLATFORMS.filter((p) => links[p]);
  const first = name.split(" ")[0];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={following ? `Redes de ${name}` : `Seguir ${name} nas redes`}
      description={following ? `Já segue ${first} nas redes sociais:` : `Abra cada rede para seguir ${first} e confirme no fim. Se já segue, diga-nos.`}
      footer={
        onConfirm &&
        (following ? (
          <>
            <button type="button" className={buttonClass("ghost")} disabled={pending} onClick={onUnfollow}>
              Afinal ainda não sigo
            </button>
            <button type="button" className={buttonClass("secondary")} onClick={onClose}>
              Fechar
            </button>
          </>
        ) : (
          <>
            <button type="button" className={buttonClass("ghost")} onClick={onClose}>
              Agora não
            </button>
            <button type="button" className={buttonClass("accent", "md", "font-semibold")} disabled={pending} onClick={onConfirm}>
              <Check className="size-4" strokeWidth={2.6} /> {opened.length ? "Concluído" : "Já sigo"}
            </button>
          </>
        ))
      }
    >
      <ul className="space-y-2">
        {networks.map((p) => {
          const seen = opened.includes(p);
          return (
            <li key={p}>
              <a
                href={links[p]}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpened((o) => (o.includes(p) ? o : [...o, p]))}
                className="group flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-line transition hover:bg-mist hover:ring-ink/20"
              >
                <PlatformTile platform={p} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{SOCIAL_PLATFORM_LABEL[p]}</span>
                  <span className="block truncate text-[13px] text-muted">{profileHandle(p, links[p]!)}</span>
                </span>
                <span className={clsx(buttonClass(seen ? "ghost" : "secondary", "sm", "pointer-events-none"), seen && "text-ok")}>
                  {seen ? (
                    <>
                      <Check className="size-3.5" strokeWidth={2.6} /> Aberto
                    </>
                  ) : (
                    <>
                      Abrir <ArrowUpRight className="size-3.5" />
                    </>
                  )}
                </span>
                <span className="sr-only">(abre noutro separador)</span>
              </a>
            </li>
          );
        })}
      </ul>
      {!following && onConfirm && <p className="mt-4 text-[12.5px] leading-relaxed text-muted">Registamos apenas a sua confirmação: as redes sociais não permitem verificar quem segue quem.</p>}
    </Dialog>
  );
}
