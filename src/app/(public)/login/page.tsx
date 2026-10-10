import { ClipboardCheck, Gauge, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { demoLoginAction } from "@/app/actions";
import { auth } from "@/server/auth";
import { demoMode } from "@/server/config";
import { currentUser, homeFor } from "@/server/session";
import { Notice } from "@/components/ui";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";
import { ResendConfirmation } from "./resend-confirmation";

export const metadata: Metadata = { title: "Entrar" };

const demos = [
  { email: "investidor@demo.ncc", icon: Gauge, title: "Investidora", who: "Helena Vasconcelos", body: "Criar desafios, avaliar, comparar e publicar resultados." },
  { email: "avaliador@demo.ncc", icon: ClipboardCheck, title: "Avaliadora", who: "Marta Quintela", body: "Avaliar as submissões atribuídas por critério." },
  { email: "membro@demo.ncc", icon: Rocket, title: "Membro", who: "Ana Ribeiro · Voltaica", body: "Descobrir desafios, gerir o projecto e submeter." },
];

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await currentUser();
  if (user) redirect(homeFor(user));
  const sp = await props.searchParams;
  const demo = demoMode();
  const canResend = !!auth().resendConfirmation;
  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle={demo ? "Entre na sua conta ou explore com uma conta de demonstração." : "Entre na sua conta."}
      aside={
        demo ? (
        <>
          <p className="text-[13px] font-semibold tracking-wide text-volt uppercase">Demonstração</p>
          <h2 className="mt-3 font-display text-4xl leading-tight font-semibold">Veja a plataforma de cada lado da mesa.</h2>
          <p className="mt-4 max-w-md text-white/70">As contas de demonstração usam dados fictícios. Pode criar, submeter e publicar à vontade — repõe-se com <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">npm run db:seed</code>.</p>
        </>
        ) : (
          <>
            <p className="text-[13px] font-semibold tracking-wide text-volt uppercase">Comunidade No Competition</p>
            <h2 className="mt-3 font-display text-4xl leading-tight font-semibold">O que é novo desde a última visita está no Início.</h2>
            <p className="mt-4 max-w-md text-white/70">Anúncios oficiais, vídeos exclusivos e desafios abertos.</p>
          </>
        )
      }
    >
      {sp.confirm && <Notice tone="ok" className="mb-6">Enviámos um link de confirmação para o seu email. Abra-o para activar a conta e entrar.</Notice>}
      {sp.deleted && <Notice tone="ok" className="mb-6">A sua conta foi eliminada.</Notice>}
      {sp.error === "link" && <Notice tone="bad" className="mb-6">O link expirou ou já foi utilizado. Entre com a sua palavra-passe ou peça um novo link.</Notice>}
      {sp.error === "demo" && <Notice tone="bad" className="mb-6">Não foi possível entrar com a conta de demonstração. Tente novamente.</Notice>}
      {demo && (
      <>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium text-muted">Entrar com um clique</p>
          <Link href="/demo" className="text-[13px] font-medium underline-offset-4 hover:underline">Visita guiada →</Link>
        </div>
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
      <div className="my-8 flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-line" /> ou com email <span className="h-px flex-1 bg-line" />
      </div>
      </>
      )}
      <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-muted underline-offset-4 hover:text-ink hover:underline">
          Esqueceu-se da palavra-passe?
        </Link>
      </p>
      {canResend && <ResendConfirmation open={!!sp.confirm} />}
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}
