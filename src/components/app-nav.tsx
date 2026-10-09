"use client";

import clsx from "clsx";
import { BookOpen, ClipboardCheck, Gauge, LayoutDashboard, Menu, MessagesSquare, Rocket, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/db/schema";
import { Drawer } from "./overlay";

const MEMBER_NAV = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/community", label: "Comunidade", icon: MessagesSquare },
  { href: "/challenges", label: "Desafios", icon: Zap },
  { href: "/projects", label: "Projectos", icon: Rocket },
  { href: "/leaderboard", label: "Classificações", icon: Trophy },
  { href: "/members", label: "Membros", icon: Users },
  { href: "/learn", label: "Aprender", icon: BookOpen },
];

function itemsFor(role: Role) {
  return [
    ...(role === "investor" ? [{ href: "/admin", label: "Painel do investidor", icon: Gauge }] : []),
    ...(role === "evaluator" ? [{ href: "/review", label: "Avaliações", icon: ClipboardCheck }] : []),
    ...MEMBER_NAV.filter((i) => role === "member" || i.href !== "/dashboard"),
  ];
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** Primary navigation: tabs from md up. */
export function AppNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="scrollbar-none -mb-px hidden gap-1 overflow-x-auto md:flex">
      {itemsFor(role).map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex h-11 items-center gap-2 border-b-2 px-2.5 text-[14px] font-medium whitespace-nowrap transition-colors",
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className="size-[17px]" strokeWidth={active ? 2.3 : 1.9} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Primary navigation below md: a menu button opening a drawer. */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = itemsFor(role);
  const current = items.find((i) => isActive(pathname, i.href));
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-full pr-3 pl-2 text-sm font-medium ring-1 ring-line hover:bg-sunken"
      >
        <Menu className="size-5" /> {current?.label ?? "Menu"}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Navegação">
        <nav aria-label="Principal">
          <ul className="space-y-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={clsx("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium", active ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken")}
                  >
                    <Icon className="size-5" /> {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Drawer>
    </div>
  );
}
