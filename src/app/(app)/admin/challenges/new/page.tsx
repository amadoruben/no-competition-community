import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { createChallengeAction } from "@/app/actions";
import { ChallengeEditor } from "@/components/challenge-editor";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Novo desafio" };

function day(n: number, h: number) {
  const d = new Date(Date.now() + n * 864e5);
  d.setHours(h, 0, 0, 0);
  return d;
}

export default async function NewChallenge() {
  await requireUser(["investor"]);
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Painel</Link>
      <PageHeader title="Novo desafio" description="Fica guardado como rascunho. Só é visível para os membros depois de o publicar." />
      <Card className="p-5 sm:p-7">
        <ChallengeEditor
          action={createChallengeAction}
          submitLabel="Criar rascunho"
          initial={{
            title: "",
            tagline: "",
            description: "",
            category: "",
            objectives: [],
            rules: ["Equipas de 1 a 4 pessoas", "Projecto original, desenvolvido pela equipa", "Uma submissão por projecto"],
            submissionInstructions: "Submeta um link para a demonstração funcional, um resumo do problema e da solução e a evidência de validação que já tenha.",
            startsAt: day(1, 9),
            submissionDeadline: day(31, 23),
            resultsDate: day(45, 18),
            maxTeamSize: 4,
            placementPoints: [300, 200, 100],
            participantsVisible: true,
            coverHue: 200,
            criteria: [
              { name: "Problema e oportunidade", description: "O problema é real, relevante e com mercado claro?", weight: 3 },
              { name: "Qualidade da solução", description: "Resolve o problema de forma clara e diferenciada?", weight: 3 },
              { name: "Execução e tracção", description: "O que já foi construído e validado?", weight: 2 },
              { name: "Equipa", description: "Tem as competências para executar?", weight: 2 },
            ],
            prizes: [{ rank: 1, title: "1.º lugar", value: "", description: "", kind: "prize" }],
          }}
        />
      </Card>
    </div>
  );
}
