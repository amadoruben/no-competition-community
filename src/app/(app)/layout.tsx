import Link from "next/link";
import { MobileNav, Sidebar } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { Toaster } from "@/components/toaster";
import { UserMenu } from "@/components/user-menu";
import { ROLE_LABEL } from "@/lib/labels";
import { homeFor, requireUser } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const brand = <Brand href={homeFor(user)} stacked />;
  const account = (
    <div className="space-y-2">
      {user.isDemo && (
        <Link href="/demo" className="block rounded-lg bg-volt-soft px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-ink uppercase ring-1 ring-volt-strong/50 hover:bg-volt" title="Abrir a visita guiada">
          Demonstração · guia
        </Link>
      )}
      <UserMenu name={user.name} handle={user.handle} hue={user.avatarHue} fileId={user.avatarFileId} roleLabel={ROLE_LABEL[user.role]} placement="up" />
    </div>
  );
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-[70] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Saltar para o conteúdo
      </a>
      <Sidebar role={user.role} handle={user.handle} brand={brand} footer={account} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav role={user.role} handle={user.handle} brand={brand} footer={account} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1160px] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
        <footer className="border-t border-line px-4 pt-5 pb-24 text-center text-[12px] text-muted sm:px-6 lg:px-10 lg:pb-5">
          No Competition Community{user.isDemo ? " · Dados de demonstração fictícios" : ""}
        </footer>
      </div>
      <Toaster />
    </div>
  );
}
