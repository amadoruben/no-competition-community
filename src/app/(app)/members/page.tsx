import { MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RoleTag } from "@/components/domain";
import { MembersSwitch } from "@/components/members-switch";
import { Avatar, Card, EmptyState, PageHeader, Pagination, SearchBox } from "@/components/ui";
import { plural } from "@/lib/format";
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
        <Card><EmptyState icon={<Users />} title={q ? "Nenhum membro encontrado" : "Ainda não há membros"}>{q ? "Experimente outro termo." : "Os membros aparecem aqui assim que se registarem."}</EmptyState></Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.rows.map(({ u, projectCount, challengeCount }) => (
            <li key={u.id}>
              <Link href={`/members/${u.handle}`} className="group block h-full rounded-[var(--radius-card)]">
                <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/80 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-pop)]">
                  <div
                    aria-hidden
                    className="h-14"
                    style={{
                      background:
                        u.role === "investor"
                          ? "radial-gradient(80% 160% at 85% 20%, rgb(212 242 74 / 0.25), transparent 60%), #101216"
                          : `linear-gradient(120deg, hsl(${u.avatarHue} 45% 86%), hsl(${(u.avatarHue + 45) % 360} 45% 78%))`,
                    }}
                  />
                  <div className="-mt-7 flex flex-1 flex-col px-4 pb-4">
                    <Avatar name={u.name} hue={u.avatarHue} fileId={u.avatarFileId} size={56} className="relative ring-4 ring-surface" />
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="truncate text-[15px] font-semibold group-hover:underline">{u.name}</h2>
                      <RoleTag role={u.role} />
                    </div>
                    {u.headline && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{u.headline}</p>}
                    {u.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {u.skills.slice(0, 3).map((s) => (
                          <span key={s} className="rounded-full bg-sunken px-2 py-0.5 text-[12px] text-ink-2">{s}</span>
                        ))}
                      </div>
                    )}
                    {(u.location || (u.role === "member" && (challengeCount > 0 || projectCount > 0))) && (
                      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-[12px] text-muted">
                        {u.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{u.location}</span>}
                        {u.role === "member" && challengeCount > 0 && <span>{plural(challengeCount, "desafio", "desafios")}</span>}
                        {u.role === "member" && projectCount > 0 && <span>{plural(projectCount, "projecto", "projectos")}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={res.page} pages={res.pages} total={res.total} label="membros" href={(n) => `/members?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`} />
    </div>
  );
}
