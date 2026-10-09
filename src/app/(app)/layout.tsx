import { AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { ROLE_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const home = user.role === "investor" ? "/admin" : user.role === "evaluator" ? "/review" : "/dashboard";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Brand href={home} />
          <div className="flex items-center gap-3">
            {user.isDemo && (
              <span className="hidden rounded-full bg-volt-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink uppercase ring-1 ring-volt-strong/50 md:inline">
                Conta de demonstração
              </span>
            )}
            <UserMenu name={user.name} handle={user.handle} hue={user.avatarHue} roleLabel={ROLE_LABEL[user.role]} />
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <AppNav role={user.role} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t border-line py-6 text-center text-[12px] text-faint">
        No Competition Community · Dados de demonstração fictícios
      </footer>
    </div>
  );
}
