"use client";

import { DatabaseZap, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatePanel, buttonClass } from "./ui";

/**
 * Shared error screen. Asks /api/health whether the data service is down so
 * the message is accurate ("temporarily unavailable" vs "something failed").
 */
export function ErrorState({ reset, digest }: { reset: () => void; digest?: string }) {
  const [dbDown, setDbDown] = useState<boolean | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h) => {
        setUnconfigured(h?.checks?.config?.ok === false);
        setDbDown(!h?.checks?.database?.ok);
      })
      .catch(() => setDbDown(true));
  }, []);
  if (dbDown === null) return <div className="min-h-[50vh]" aria-busy="true" />;
  return dbDown ? (
    <StatePanel
      tone="warn"
      icon={<DatabaseZap className="size-6" />}
      title="Serviço temporariamente indisponível"
      action={
        <button type="button" onClick={reset} className={buttonClass("primary")}>
          <RefreshCw className="size-4" /> Tentar novamente
        </button>
      }
    >
      {unconfigured
        ? "Esta instalação ainda não está ligada à base de dados. Nenhum dado foi lido ou alterado."
        : "Não conseguimos contactar o serviço de dados. Nenhuma alteração foi perdida nem registada parcialmente. Tente novamente dentro de momentos."}
    </StatePanel>
  ) : (
    <StatePanel
      tone="bad"
      icon={<TriangleAlert className="size-6" />}
      title="Algo correu mal"
      action={
        <>
          <button type="button" onClick={reset} className={buttonClass("primary")}>
            <RefreshCw className="size-4" /> Tentar novamente
          </button>
          <Link href="/" className={buttonClass("secondary")}>
            Ir para o início
          </Link>
        </>
      }
    >
      Ocorreu um erro inesperado ao carregar esta página.
      {digest && <span className="mt-2 block font-mono text-[12px] text-muted">Referência: {digest}</span>}
    </StatePanel>
  );
}
