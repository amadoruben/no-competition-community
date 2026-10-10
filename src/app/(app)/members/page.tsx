import { MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RoleTag } from "@/components/domain";
import { MembersSwitch } from "@/components/members-switch";
import { Avatar, Card, EmptyState, PageHeader, Pagination, SearchBox } from "@/components/ui";
import { listMembers } from "@/server/members";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Membros" };

export default async function MembersPage(props: PageProps<"/members">) {
  await requireUser();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = Number(sp.page) || 1;
  const res = await listMembers({ q, page });
  return (
    <div>
      <MembersSwitch active="members" />
      <PageHeader
        title="Membros"
        description="Quem faz parte da comunidade No Competition. Encontre pessoas com os mesmos interesses ou equipa para os desafios."
        actions={<SearchBox defaultValue={q} placeholder="Nome, competência, cidade" label="Procurar membros" />}
      />
      {res.rows.length === 0 ? (
        <Card><EmptyState icon={<Users className="size-5" />} title={q ? "Nenhum membro encontrado" : "Ainda não há membros"}>{q ? "Experimente outro termo." : "Os membros aparecem aqui assim que se registarem."}</EmptyState></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.rows.map(({ u, projectCount, challengeCount }) => (
            <Link key={u.id} href={`/members/${u.handle}`} className="group">
              <Card className="flex h-full flex-col p-4 transition-shadow group-hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-start gap-3">
                  <Avatar name={u.name} hue={u.avatarHue} fileId={u.avatarFileId} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold group-hover:underline">{u.name}</span>
                      <RoleTag role={u.role} />
                    </div>
                    <div className="line-clamp-2 text-[13px] text-ink-2">{u.headline}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {u.skills.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full bg-sunken px-2 py-0.5 text-[12px] text-ink-2">{s}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-3 pt-4 text-[12px] text-muted">
                  {u.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{u.location}</span>}
                  {u.role === "member" && challengeCount > 0 && <span>{challengeCount} {challengeCount === 1 ? "desafio" : "desafios"}</span>}
                  {u.role === "member" && projectCount > 0 && <span>{projectCount} {projectCount === 1 ? "projecto" : "projectos"}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Pagination page={res.page} pages={res.pages} total={res.total} label="membros" href={(n) => `/members?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`} />
    </div>
  );
}
