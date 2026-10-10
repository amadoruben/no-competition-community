import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { cx } from "@/components/ui";

/**
 * Sign-in, sign-up and password recovery. A light brand panel on large screens;
 * on phones the form comes first, under the brand, at a comfortable width.
 * `mode` shows the Entrar / Criar conta switch at the top of the form.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  aside,
  mode,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  mode?: "login" | "register";
}) {
  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative hidden overflow-hidden border-r border-line bg-mist lg:block">
        <div aria-hidden className="paper-grid absolute inset-0 [mask-image:radial-gradient(85%_75%_at_25%_45%,black,transparent)]" />
        <div aria-hidden className="absolute -right-56 -bottom-64 size-[620px] rounded-full border border-gold/35" />
        <div aria-hidden className="absolute -right-32 -bottom-40 size-[420px] rounded-full border-2 border-gold/45" />
        <div className="relative flex h-full min-h-dvh flex-col p-10 xl:p-14">
          <Brand stacked />
          <div className="my-auto max-w-[480px] py-12">{aside ?? <AuthAside />}</div>
          <p className="text-[12.5px] text-muted">© No Competition</p>
        </div>
      </div>

      <div className="flex min-h-dvh flex-col px-4 py-5 sm:px-8 lg:py-8">
        <div className="lg:hidden">
          <Brand stacked />
        </div>
        <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 lg:py-12">
          {mode && (
            <nav aria-label="Conta" className="mb-8 grid grid-cols-2 rounded-full bg-sunken p-1 text-[14px] font-medium">
              {(
                [
                  ["login", "/login", "Entrar"],
                  ["register", "/register", "Criar conta"],
                ] as const
              ).map(([key, href, label]) => (
                <Link
                  key={key}
                  href={href}
                  aria-current={mode === key ? "page" : undefined}
                  className={cx(
                    "rounded-full py-2 text-center transition-colors",
                    mode === key ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-muted hover:text-ink",
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
          <h1 className="font-display text-[28px] leading-tight font-bold sm:text-[32px]">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </main>
        <p className="text-center text-[12.5px] text-muted lg:hidden">© No Competition</p>
      </div>
    </div>
  );
}

/** Default brand panel: what the community offers, stated as it works today. */
export function AuthAside({ title = "Construa algo que não tem concorrência.", points }: { title?: string; points?: string[] }) {
  const list = points ?? [
    "Anúncios oficiais, conversas e perguntas entre membros.",
    "Vídeos da No Competition, organizados por colecções.",
    "Desafios com regras, critérios e prémios publicados.",
  ];
  return (
    <>
      <p className="eyebrow">Comunidade No Competition</p>
      <h2 className="mt-4 font-display text-[36px] leading-[1.1] font-extrabold text-ink xl:text-[42px]">{title}</h2>
      <ul className="mt-8 space-y-4">
        {list.map((p) => (
          <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gold text-ink">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            {p}
          </li>
        ))}
      </ul>
    </>
  );
}
