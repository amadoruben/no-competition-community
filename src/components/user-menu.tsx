"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions";
import { Avatar } from "./ui";

export function UserMenu({ name, handle, hue, fileId, roleLabel }: { name: string; handle: string; hue: number; fileId?: string | null; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Conta de ${name}`}
        className="flex items-center gap-2 rounded-full p-0.5 pr-0.5 transition-colors hover:bg-sunken sm:pr-3"
      >
        <Avatar name={name} hue={hue} fileId={fileId} size={34} />
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] leading-tight font-medium">{name.split(" ")[0]}</span>
          <span className="block text-[11px] leading-tight text-muted">{roleLabel}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl bg-surface p-1 shadow-[var(--shadow-pop)] ring-1 ring-line">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="text-[12px] text-muted">@{handle}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href={`/members/${handle}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sunken">
            <UserRound className="size-4 text-muted" /> O meu perfil
          </Link>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sunken">
            <Settings className="size-4 text-muted" /> Editar perfil
          </Link>
          <form action={logoutAction}>
            <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-bad hover:bg-bad-soft">
              <LogOut className="size-4" /> Terminar sessão
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
