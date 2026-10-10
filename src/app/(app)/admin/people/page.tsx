import { UserCog } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RoleTag } from "@/components/domain";
import { Avatar, Card, EmptyState, Notice, PageHeader, SearchBox } from "@/components/ui";
import { fmtDay, plural } from "@/lib/format";
import { listPeople } from "@/server/people";
import { requireUser } from "@/server/session";
import { RoleControl } from "./role-control";

export const metadata: Metadata = { title: "Membros e papéis" };

export default async function PeoplePage(props: PageProps<"/admin/people">) {
  const user = await requireUser(["investor"]);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const { rows, counts } = await listPeople(user, { q });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Membros e papéis"
        description={[plural(counts.member, "membro", "membros"), plural(counts.evaluator, "avaliador(a)", "avaliadores"), plural(counts.investor, "investidor(a)", "investidores")].join(" · ")}
        actions={<SearchBox defaultValue={q} placeholder="Nome ou email" label="Procurar pessoas" />}
      />
      <Notice tone="info">
        Avaliadores vêem apenas as submissões dos desafios a que os atribuir (no desafio → <span className="font-medium">Avaliadores</span>). As notas ficam privadas até publicar os resultados.
      </Notice>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<UserCog className="size-5" />} title={q ? "Ninguém encontrado" : "Ainda não há membros"}>
            {q ? "Experimente outro termo." : "Partilhe o endereço da plataforma: quem se registar aparece aqui."}
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <Avatar name={p.name} hue={p.avatarHue} fileId={p.avatarFileId} size={38} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/members/${p.handle}`} className="truncate font-medium hover:underline">{p.name}</Link>
                  <RoleTag role={p.role} />
                  {p.id === user.id && <span className="text-[12px] text-muted">(você)</span>}
                </div>
                <div className="truncate text-[13px] text-muted">
                  {p.email} · desde {fmtDay(p.createdAt)}
                </div>
              </div>
              {p.role !== "investor" && p.id !== user.id && <RoleControl userId={p.id} role={p.role} />}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
