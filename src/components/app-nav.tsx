"use client";

import clsx from "clsx";
import { ClipboardCheck, Gauge } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/db/schema";
import { mainItems, toolsFor } from "@/lib/nav";

/** Desktop: the five areas as tabs in the header. */
export function TopNav({ handle }: { handle: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="hidden h-full lg:block">
      <ul className="flex h-full items-stretch gap-1">
        {mainItems(handle).map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex items-center gap-2 rounded-md px-3 text-[14px] font-medium transition-colors",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:transition-colors",
                  active ? "text-ink after:bg-ink" : "text-muted after:bg-transparent hover:text-ink",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.3 : 1.9} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
        active ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line-strong hover:bg-sunken",
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
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phones and tablets: the five areas in a bottom bar, within thumb reach. */
export function MobileTabs({ handle }: { handle: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secções" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {mainItems(handle).map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-ink" : "text-muted")}
              >
                <span className={clsx("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-volt")}>
                  <Icon className="size-[19px]" strokeWidth={active ? 2.4 : 1.9} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
