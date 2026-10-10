import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar acesso"
      subtitle="Indique o email da sua conta. Enviamos um link para definir uma nova palavra-passe."
      aside={<h2 className="font-display text-4xl leading-tight font-semibold">O link é válido durante uma hora e só pode ser usado uma vez.</h2>}
    >
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted">
        Lembrou-se?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
