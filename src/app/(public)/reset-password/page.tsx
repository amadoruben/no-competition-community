import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { TOKEN_HASH_PREFIX } from "@/lib/auth-links";
import { AuthAside, AuthShell } from "../auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova palavra-passe" };

/** Accepts ?token= (local provider), ?code= (Supabase PKCE link) or ?token_hash= (Supabase template link, any device). */
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const sp = await props.searchParams;
  const token =
    typeof sp.token === "string" ? sp.token : typeof sp.code === "string" ? sp.code : typeof sp.token_hash === "string" ? `${TOKEN_HASH_PREFIX}${sp.token_hash}` : "";
  return (
    <AuthShell
      title="Nova palavra-passe"
      subtitle="Escolha uma palavra-passe com pelo menos 8 caracteres."
      aside={<AuthAside title="Uma palavra-passe nova, um acesso seguro." points={["Use pelo menos 8 caracteres.", "Depois de guardar, entra directamente na comunidade."]} />}
    >
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
