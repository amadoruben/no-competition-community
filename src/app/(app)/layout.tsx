import Link from "next/link";
import { HeaderSearch, MobileTabs, ToolsLink, TopNav } from "@/components/app-nav";
import { toolsFor } from "@/lib/nav";
import { Brand } from "@/components/brand";
import { Toaster } from "@/components/toaster";
import { UserMenu } from "@/components/user-menu";
import { ROLE_LABEL } from "@/lib/labels";
import { homeFor, requireUser } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const tools = toolsFor(user.role).map(({ href, label }) => ({ href, label }));
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-[70] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Saltar para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center gap-6 px-4 sm:px-6 lg:h-16">
          <Brand href={homeFor(user)} stacked />
          <HeaderSearch />
          <div className="ml-auto flex items-center gap-2">
            {user.isDemo && (
              <Link href="/demo" className="hidden h-8 items-center rounded-full bg-gold-soft px-3 text-[11px] font-semibold tracking-wide text-ink uppercase ring-1 ring-gold-strong/50 hover:bg-gold sm:inline-flex" title="Abrir a visita guiada">
                Demonstração
              </Link>
            )}
            <ToolsLink role={user.role} />
            <UserMenu name={user.name} handle={user.handle} hue={user.avatarHue} fileId={user.avatarFileId} roleLabel={ROLE_LABEL[user.role]} tools={tools} demo={user.isDemo} />
          </div>
        </div>
        <div className="mx-auto hidden max-w-[1040px] px-4 sm:px-6 lg:block">
          <TopNav />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1040px] flex-1 px-4 py-6 outline-none sm:px-6 lg:py-7">
        {children}
      </main>
      <footer className="border-t border-line px-4 pt-5 pb-28 text-center text-[12px] text-muted sm:px-6 lg:pb-5">
        No Competition Community{user.isDemo ? " · Dados de demonstração fictícios" : ""}
      </footer>
      <MobileTabs handle={user.handle} me={{ name: user.name, hue: user.avatarHue, fileId: user.avatarFileId }} />
      <Toaster />
    </div>
  );
}
