"use client";

import clsx from "clsx";
import {
  BriefcaseBusiness,
  Clapperboard,
  ClipboardCheck,
  Gauge,
  Home,
  Menu,
  Plus,
  UserCog,
  UserRound,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Role } from "@/db/schema";
import { Drawer } from "./overlay";

type Item = { href: string; label: string; short?: string; icon: LucideIcon; match: (path: string) => boolean };
type Group = { title: string; items: Item[] };

const under = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p === x || p.startsWith(x + "/"));

/** The five areas every member sees, in this order. The profile owns /members/<own handle>. */
function mainItems(handle: string): Item[] {
  const own = under("/profile", "/settings", `/members/${handle}`);
  return [
    { href: "/dashboard", label: "Início", icon: Home, match: under("/dashboard", "/community") },
    { href: "/videos", label: "Vídeos", icon: Video, match: under("/videos", "/learn") },
    { href: "/challenges", label: "Desafios", icon: Zap, match: under("/challenges") },
    { href: "/members", label: "Membros", icon: Users, match: (p) => !own(p) && under("/members", "/leaderboard", "/projects")(p) },
    { href: "/profile", label: "Perfil", icon: UserRound, match: own },
  ];
}

/** Management tools stay in their own group, only for the roles that use them. */
function toolGroup(role: Role): Group | null {
  if (role === "investor")
    return {
      title: "Administração",
      items: [
        { href: "/admin", label: "Painel e desafios", icon: Gauge, match: (p) => p === "/admin" || under("/admin/challenges")(p) },
        { href: "/admin/videos", label: "Gerir vídeos", icon: Clapperboard, match: under("/admin/videos") },
        { href: "/admin/people", label: "Membros e acessos", icon: UserCog, match: under("/admin/people") },
        { href: "/admin/opportunities", label: "Pipeline de investimento", icon: BriefcaseBusiness, match: under("/admin/opportunities") },
      ],
    };
  if (role === "evaluator") return { title: "Avaliação", items: [{ href: "/review", label: "Avaliações", icon: ClipboardCheck, match: under("/review", "/evaluate") }] };
  return null;
}

export function navFor(role: Role, handle: string): Group[] {
  const tools = toolGroup(role);
  return [{ title: "Comunidade", items: mainItems(handle) }, ...(tools ? [tools] : [])];
}

function NavLink({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx("flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors", active ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken hover:text-ink")}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.3 : 1.9} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavList({ role, handle, onNavigate }: { role: Role; handle: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="space-y-6">
      {role === "investor" && (
        <Link
          href="/admin/challenges/new"
          onClick={onNavigate}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-volt text-sm font-semibold text-ink ring-1 ring-volt-strong/60 transition-colors hover:bg-volt-strong"
        >
          <Plus className="size-4" strokeWidth={2.5} /> Novo desafio
        </Link>
      )}
      {navFor(role, handle).map((g, i) => (
        <div key={g.title}>
          {i > 0 && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={item.match(pathname)} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar from lg up: the column spans the page, its content stays in view. `footer` holds the account block. */
export function Sidebar({ role, handle, brand, footer }: { role: Role; handle: string; brand: ReactNode; footer: ReactNode }) {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-line bg-surface lg:block">
      <div className="sticky top-0 flex h-dvh flex-col">
        <div className="flex h-16 items-center px-5">{brand}</div>
        <div className="scrollbar-none flex-1 overflow-y-auto px-3 pt-2 pb-6">
          <NavList role={role} handle={handle} />
        </div>
        <div className="border-t border-line p-3">{footer}</div>
      </div>
    </aside>
  );
}

/**
 * Below lg: a top bar (brand + menu with management tools and the account) and
 * a bottom tab bar with the five main areas, always within thumb reach.
 */
export function MobileNav({ role, handle, brand, footer }: { role: Role; handle: string; brand: ReactNode; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-full ring-1 ring-line hover:bg-sunken"
        >
          <Menu className="size-5" />
        </button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-3">
              <NavList role={role} handle={handle} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-line p-3">{footer}</div>
          </div>
        </Drawer>
      </div>
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
    </>
  );
}
