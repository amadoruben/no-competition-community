"use client";

import clsx from "clsx";
import {
  BookOpen,
  BriefcaseBusiness,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  Plus,
  Rocket,
  Trophy,
  UserCog,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Role } from "@/db/schema";
import { Drawer } from "./overlay";

type Item = { href: string; label: string; icon: LucideIcon; match?: (path: string) => boolean };
type Group = { title: string; items: Item[] };

const under = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p === x || p.startsWith(x + "/"));

const EXPLORE: Group = {
  title: "Explorar",
  items: [
    { href: "/challenges", label: "Desafios", icon: Zap },
    { href: "/projects", label: "Projectos", icon: Rocket },
    { href: "/members", label: "Membros", icon: Users },
    { href: "/leaderboard", label: "Classificações", icon: Trophy },
  ],
};
const COMMUNITY: Group = {
  title: "Comunidade",
  items: [
    { href: "/community", label: "Publicações", icon: MessagesSquare },
    { href: "/learn", label: "Aprender", icon: BookOpen },
  ],
};

/** Navigation by role: what the person manages first, then what everyone shares. */
export function navFor(role: Role): Group[] {
  if (role === "investor")
    return [
      {
        title: "Gestão",
        items: [
          { href: "/admin", label: "Painel", icon: Gauge, match: (p) => p === "/admin" || under("/admin/challenges")(p) },
          { href: "/admin/opportunities", label: "Pipeline de investimento", icon: BriefcaseBusiness },
          { href: "/admin/people", label: "Membros e papéis", icon: UserCog },
        ],
      },
      EXPLORE,
      COMMUNITY,
    ];
  if (role === "evaluator")
    return [{ title: "Trabalho", items: [{ href: "/review", label: "Avaliações", icon: ClipboardCheck, match: under("/review", "/evaluate") }] }, EXPLORE, COMMUNITY];
  return [{ title: "O meu espaço", items: [{ href: "/dashboard", label: "Início", icon: LayoutDashboard }] }, EXPLORE, COMMUNITY];
}

const QUICK: Partial<Record<Role, { href: string; label: string }>> = {
  investor: { href: "/admin/challenges/new", label: "Novo desafio" },
  member: { href: "/projects/new", label: "Novo projecto" },
};

const isActive = (path: string, item: Item) => (item.match ?? under(item.href))(path);

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const quick = QUICK[role];
  return (
    <nav aria-label="Principal" className="space-y-6">
      {quick && (
        <Link
          href={quick.href}
          onClick={onNavigate}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-volt text-sm font-semibold text-ink ring-1 ring-volt-strong/60 transition-colors hover:bg-volt-strong"
        >
          <Plus className="size-4" strokeWidth={2.5} /> {quick.label}
        </Link>
      )}
      {navFor(role).map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[14px] font-medium transition-colors",
                      active ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken hover:text-ink",
                    )}
                  >
                    <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2.3 : 1.9} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar from lg up: the column spans the page, its content stays in view. `footer` holds the account block. */
export function Sidebar({ role, brand, footer }: { role: Role; brand: ReactNode; footer: ReactNode }) {
  return (
    <aside className="hidden w-[264px] shrink-0 border-r border-line bg-surface lg:block">
      <div className="sticky top-0 flex h-dvh flex-col">
        <div className="flex h-16 items-center px-5">{brand}</div>
        <div className="scrollbar-none flex-1 overflow-y-auto px-3 pt-2 pb-6">
          <NavList role={role} />
        </div>
        <div className="border-t border-line p-3">{footer}</div>
      </div>
    </aside>
  );
}

/** Below lg: top bar with a menu button opening the same navigation in a drawer. */
export function MobileNav({ role, brand, footer }: { role: Role; brand: ReactNode; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
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
            <NavList role={role} onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-line p-3">{footer}</div>
        </div>
      </Drawer>
    </div>
  );
}
