import { MapPin, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RoleTag } from "@/components/domain";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { listMembers } from "@/server/members";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Membros" };

export default async function MembersPage(props: PageProps<"/members">) {
  await requireUser();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const rows = listMembers(q);
  return (
    <div>
      <PageHeader
        title="Membros"
        description="Fundadores, engenheiros, designers e avaliadores. Encontre equipa ou quem já resolveu o seu problema."
        actions={
          <form className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input name="q" defaultValue={q} placeholder="Nome, competência, cidade" aria-label="Procurar membros" className="h-10 w-full rounded-full bg-surface pr-3 pl-9 text-sm ring-1 ring-line ring-inset focus:ring-2 focus:ring-ink focus:outline-none" />
          </form>
        }
      />
      {rows.length === 0 ? (
        <Card><EmptyState icon={<Users className="size-5" />} title="Nenhum membro encontrado" /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ u, projectCount, challengeCount }) => (
            <Link key={u.id} href={`/members/${u.handle}`} className="group">
              <Card className="flex h-full flex-col p-4 transition-shadow group-hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-start gap-3">
                  <Avatar name={u.name} hue={u.avatarHue} size={44} />
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
                  {u.role === "member" && <span>{projectCount} projectos · {challengeCount} desafios</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
