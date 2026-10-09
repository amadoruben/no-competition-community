import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/session";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <AuthShell
      title="Junte-se à comunidade"
      subtitle="Participe em desafios, apresente o seu projecto e ganhe visibilidade junto de investidores."
      aside={
        <ul className="space-y-6">
          {[
            ["Desafios com critérios públicos", "Sabe desde o início como vai ser avaliado."],
            ["Feedback de avaliadores", "Cada submissão recebe notas por critério e comentários."],
            ["Mérito, não popularidade", "As classificações separam participação de qualidade."],
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
