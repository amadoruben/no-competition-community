import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { currentUser, homeFor } from "@/server/session";
import { AuthAside, AuthShell } from "../auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user));
  // Providers with email confirmation (Supabase) can resend it; local accounts start at once.
  const confirms = !!auth().resendConfirmation;
  return (
    <AuthShell
      mode="register"
      title="Criar conta"
      subtitle={
        confirms
          ? "A conta é gratuita. Depois de a criar, confirme o email com o link que lhe enviamos."
          : "A conta é gratuita e fica pronta a usar."
      }
      aside={
        <AuthAside
          title="Junte-se a quem está a construir."
          points={[
            "Anúncios oficiais da No Competition, conversas e perguntas entre membros.",
            "Vídeos com episódios, bastidores e ensinamentos, organizados por colecção.",
            "Desafios com regras e critérios públicos, avaliação independente e resultados publicados.",
          ]}
        />
      }
    >
      <RegisterForm />
      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        O seu perfil fica visível para os membros da comunidade; o email não. Pode eliminar a conta a qualquer momento nas definições.
      </p>
    </AuthShell>
  );
}
