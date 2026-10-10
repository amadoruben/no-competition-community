"use client";

import clsx from "clsx";
import { ClipboardCheck, Gauge, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/db/schema";
import { mainItems, sectionTabs, toolsFor } from "@/lib/nav";
import { Avatar } from "./ui";

/** Desktop: the community's sections as text tabs under the header row, Skool-style. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="hidden lg:block">
      <ul className="flex items-stretch gap-7">
        {sectionTabs().map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "-mb-px flex h-11 items-center border-b-[2.5px] text-[14.5px] transition-colors",
                  active ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The search field in the header: finds members by name, skill or city. */
export function HeaderSearch() {
  return (
    <form action="/members" role="search" className="hidden max-w-[480px] flex-1 md:block">
      <label className="flex h-10 items-center gap-2.5 rounded-xl bg-sunken px-3.5 text-muted ring-1 ring-transparent ring-inset focus-within:bg-surface focus-within:ring-ink">
        <Search className="size-[18px] shrink-0" />
        <span className="sr-only">Pesquisar membros</span>
        <input name="q" type="search" placeholder="Pesquisar" className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-muted" />
      </label>
    </form>
  );
}

/** Desktop: one entry point to the role's tools (admin or evaluation), next to the account menu. */
export function ToolsLink({ role }: { role: Role }) {
  const pathname = usePathname();
  const tools = toolsFor(role);
  if (!tools.length) return null;
  const active = tools.some((t) => t.match(pathname));
  const label = role === "investor" ? "Administração" : "Avaliações";
  const Icon = role === "investor" ? Gauge : ClipboardCheck;
  return (
    <Link
      href={tools[0].href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "hidden h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium ring-1 transition-colors ring-inset lg:inline-flex",
        active ? "bg-gold-soft text-ink ring-gold" : "bg-surface text-ink ring-line-strong hover:bg-mist",
      )}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}

/** Tabs inside the admin area (Administração). */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="scrollbar-none -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {toolsFor("investor").map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className={clsx("size-4", active && "text-gold-strong")} /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Phones and tablets: the five areas in a floating bar within thumb reach,
 * each with its name under the icon, your photo for Perfil, and a gold mark on
 * the current area.
 */
export function MobileTabs({ handle, me }: { handle: string; me: { name: string; hue: number; fileId: string | null } }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secções" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="pointer-events-auto mx-auto grid max-w-[460px] grid-cols-5 rounded-[26px] bg-surface/92 px-1.5 py-1.5 shadow-[0_18px_40px_-14px_rgb(22_19_14/0.35),0_2px_8px_-2px_rgb(22_19_14/0.12)] ring-1 ring-line/90 backdrop-blur-xl">
        {mainItems(handle).map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const profile = item.href === "/profile";
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx("flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] transition-colors", active ? "bg-gold-soft font-semibold text-ink" : "font-medium text-muted active:bg-sunken")}
              >
                {profile ? (
                  <span className={clsx("rounded-full", active ? "ring-2 ring-gold" : "ring-1 ring-line")}>
                    <Avatar name={me.name} hue={me.hue} fileId={me.fileId} size={22} />
                  </span>
                ) : (
                  <Icon className={clsx("size-[22px]", active && "text-gold-strong")} strokeWidth={active ? 2.3 : 1.8} />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
