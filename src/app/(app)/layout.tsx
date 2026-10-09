import Link from "next/link";
import { AppNav, MobileNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { Toaster } from "@/components/toaster";
import { UserMenu } from "@/components/user-menu";
import { ROLE_LABEL } from "@/lib/labels";
import { homeFor, requireUser } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-[70] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Saltar para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Brand href={homeFor(user)} compact={false} className="max-[380px]:[&>span]:hidden" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {user.isDemo && (
              <Link href="/demo" className="hidden rounded-full bg-volt-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink uppercase ring-1 ring-volt-strong/50 hover:bg-volt lg:inline" title="Abrir a visita guiada">
                Demonstração · guia
              </Link>
            )}
            <UserMenu name={user.name} handle={user.handle} hue={user.avatarHue} fileId={user.avatarFileId} roleLabel={ROLE_LABEL[user.role]} />
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-4 pb-2 sm:px-6 md:pb-0">
          <AppNav role={user.role} />
          <MobileNav role={user.role} />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-line py-6 text-center text-[12px] text-muted">
        No Competition Community{user.isDemo ? " · Dados de demonstração fictícios" : ""}
      </footer>
      <Toaster />
    </div>
  );
}
