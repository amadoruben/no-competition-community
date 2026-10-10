import { ClipboardCheck, Gauge, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { demoLoginAction } from "@/app/actions";
import { auth } from "@/server/auth";
import { demoMode } from "@/server/config";
import { currentUser, homeFor } from "@/server/session";
import { Notice } from "@/components/ui";
import { AuthAside, AuthShell } from "../auth-shell";
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
      mode="login"
      title="Bem-vindo de volta"
      subtitle={demo ? "Entre na sua conta ou explore com uma conta de demonstração." : "Entre com o email e a palavra-passe da sua conta."}
      aside={
        demo ? (
          <AuthAside
            title="Veja a plataforma de cada lado da mesa."
            points={[
              "As contas de demonstração usam dados fictícios.",
              "Membro, avaliadora ou investidora: cada papel vê o que lhe compete.",
              "Pode publicar, submeter e avaliar sem afectar contas reais.",
            ]}
          />
        ) : (
          <AuthAside title="O que é novo desde a última visita está no Início." />
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
              <Link href="/demo" className="text-[13px] font-medium text-gold-strong underline-offset-4 hover:underline">
                Visita guiada →
              </Link>
            </div>
            {demos.map(({ email, icon: Icon, title, who, body }) => (
              <form key={email} action={demoLoginAction}>
                <input type="hidden" name="email" value={email} />
                <button className="group flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left ring-1 ring-line transition hover:bg-mist hover:ring-ink/25">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-strong ring-1 ring-gold-line">
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
      {/*
        Other sign-in methods (Google, Apple…) belong here, above the email form,
        once a provider is configured in Supabase Auth and wired through
        AuthProvider. None is configured, so none is shown.
      */}
      <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} />
      {canResend && <ResendConfirmation open={!!sp.confirm} />}
    </AuthShell>
  );
}
