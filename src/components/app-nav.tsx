"use client";

import clsx from "clsx";
import { BookOpen, ClipboardCheck, Gauge, LayoutDashboard, MessagesSquare, Rocket, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/db/schema";

const MEMBER_NAV = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/community", label: "Comunidade", icon: MessagesSquare },
  { href: "/challenges", label: "Desafios", icon: Zap },
  { href: "/projects", label: "Projectos", icon: Rocket },
  { href: "/leaderboard", label: "Classificações", icon: Trophy },
  { href: "/members", label: "Membros", icon: Users },
  { href: "/learn", label: "Aprender", icon: BookOpen },
];

export function AppNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = [
    ...(role === "investor" ? [{ href: "/admin", label: "Painel do investidor", icon: Gauge }] : []),
    ...(role === "evaluator" ? [{ href: "/review", label: "Avaliações", icon: ClipboardCheck }] : []),
    ...MEMBER_NAV.filter((i) => role === "member" || i.href !== "/dashboard"),
  ];
  return (
    <nav aria-label="Principal" className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
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
