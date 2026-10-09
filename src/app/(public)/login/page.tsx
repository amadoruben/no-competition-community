import { ClipboardCheck, Gauge, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { demoLoginAction } from "@/app/actions";
import { currentUser } from "@/server/session";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const demos = [
  { email: "investidor@demo.ncc", icon: Gauge, title: "Investidora", who: "Helena Vasconcelos", body: "Criar desafios, avaliar, comparar e publicar resultados." },
  { email: "avaliador@demo.ncc", icon: ClipboardCheck, title: "Avaliadora", who: "Marta Quintela", body: "Avaliar as submissões atribuídas por critério." },
  { email: "membro@demo.ncc", icon: Rocket, title: "Membro", who: "Ana Ribeiro · Voltaica", body: "Descobrir desafios, gerir o projecto e submeter." },
];

export default async function LoginPage(props: PageProps<"/login">) {
  if (await currentUser()) redirect("/dashboard");
  const sp = await props.searchParams;
  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre na sua conta ou explore com uma conta de demonstração."
      aside={
        <>
          <p className="text-[13px] font-semibold tracking-wide text-volt uppercase">Demonstração</p>
          <h2 className="mt-3 font-display text-4xl leading-tight font-semibold">Veja a plataforma de cada lado da mesa.</h2>
          <p className="mt-4 max-w-md text-white/70">As contas de demonstração usam dados fictícios. Pode criar, submeter e publicar à vontade — repõe-se com <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">npm run db:seed</code>.</p>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-muted">Entrar com um clique</p>
        {demos.map(({ email, icon: Icon, title, who, body }) => (
          <form key={email} action={demoLoginAction}>
            <input type="hidden" name="email" value={email} />
            <button className="group flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left ring-1 ring-line transition hover:ring-ink">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-volt-soft ring-1 ring-volt-strong/40">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {title} <span className="font-normal text-muted">· {who}</span>
                </span>
                <span className="block truncate text-[13px] text-muted">{body}</span>
              </span>
            </button>
          </form>
        ))}
      </div>
      <div className="my-8 flex items-center gap-3 text-[12px] text-faint">
        <span className="h-px flex-1 bg-line" /> ou com email <span className="h-px flex-1 bg-line" />
      </div>
      <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} />
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}
