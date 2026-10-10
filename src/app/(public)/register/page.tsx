import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/server/session";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user));
  return (
    <AuthShell
      title="Junte-se à comunidade"
      subtitle="A comunidade oficial da No Competition. A conta é gratuita."
      aside={
        <ul className="space-y-6">
          {[
            ["Comunidade", "Anúncios oficiais da No Competition, conversas e perguntas entre membros."],
            ["Vídeos exclusivos", "Episódios, bastidores e ensinamentos, organizados por colecção."],
            ["Desafios com prémios", "Regras e critérios públicos, avaliação independente e resultados transparentes."],
          ].map(([t, b]) => (
            <li key={t}>
              <p className="font-display text-2xl font-semibold">{t}</p>
              <p className="mt-1 text-white/65">{b}</p>
            </li>
          ))}
        </ul>
      }
    >
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
