import { SearchX } from "lucide-react";
import Link from "next/link";
import { StatePanel, buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1200px] px-4">
      <StatePanel
        icon={<SearchX className="size-6" />}
        title="Página não encontrada"
        action={
          <Link href="/" className={buttonClass("primary")}>
            Ir para o início
          </Link>
        }
      >
        O endereço pode estar errado, ou o conteúdo foi removido ou ainda não está publicado.
      </StatePanel>
    </main>
  );
}
