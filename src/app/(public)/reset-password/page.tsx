import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { AuthShell } from "../auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova palavra-passe" };

/** Accepts ?token= (local provider) or ?code= (Supabase PKCE link). */
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : typeof sp.code === "string" ? sp.code : "";
  return (
    <AuthShell title="Nova palavra-passe" subtitle="Escolha uma palavra-passe com pelo menos 8 caracteres." aside={<h2 className="font-display text-4xl leading-tight font-semibold">Todas as sessões anteriores serão terminadas.</h2>}>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <Notice tone="bad">
          Link inválido.{" "}
          <Link href="/forgot-password" className="font-medium underline">
            Peça um novo
          </Link>
          .
        </Notice>
      )}
    </AuthShell>
  );
}
