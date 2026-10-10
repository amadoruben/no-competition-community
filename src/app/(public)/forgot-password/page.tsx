import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthAside, AuthShell } from "../auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar acesso"
      subtitle="Indique o email da sua conta. Enviamos um link para definir uma nova palavra-passe."
      aside={
        <AuthAside
          title="Volte à comunidade em poucos minutos."
          points={["O link chega ao email da conta.", "Só pode ser usado uma vez.", "Por segurança, não dizemos se o email tem conta."]}
        />
      }
    >
      <ForgotForm />
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-ink underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" /> Voltar a entrar
        </Link>
      </p>
    </AuthShell>
  );
}
