import { BadgeCheck, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MembersSwitch } from "@/components/members-switch";
import { Avatar, Card, EmptyState, PageHeader, Pagination, SearchBox } from "@/components/ui";
import { plural } from "@/lib/format";
import { listMembers } from "@/server/members";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Membros" };

export default async function MembersPage(props: PageProps<"/members">) {
  const viewer = await requireUser();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = Number(sp.page) || 1;
  const res = await listMembers(viewer, { q, page });
  return (
    <div className="space-y-6">
      <div>
        <MembersSwitch active="members" />
        <PageHeader
          title="Membros"
          description="Quem faz parte da comunidade No Competition. Encontre pessoas com os mesmos interesses ou equipa para os desafios."
          actions={<SearchBox defaultValue={q} placeholder="Nome, competência, cidade" label="Procurar membros" />}
        />
      </div>

      {res.rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Users />} title={q ? "Nenhum membro encontrado" : "Ainda não há membros"}>
            {q ? "Experimente outro termo." : "Os membros aparecem aqui assim que se registarem."}
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.rows.map(({ u, projectCount, challengeCount }) => (
            <li key={u.id}>
              <div className="flex h-full flex-col rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-line/80">
                <Link href={`/members/${u.handle}`} className="group flex items-center gap-3">
                  <Avatar name={u.name} hue={u.avatarHue} fileId={u.avatarFileId} size={56} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1">
                      <h2 className="truncate text-[15px] font-semibold group-hover:underline">{u.name}</h2>
                      {u.role === "investor" && <BadgeCheck aria-label="Conta oficial No Competition" className="size-4 shrink-0 fill-ink text-gold" />}
                    </span>
                    <span className="block truncate text-[13px] text-muted">@{u.handle}</span>
                  </span>
                </Link>
                {u.headline && <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{u.headline}</p>}
                {u.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {u.skills.slice(0, 3).map((s) => (
                      <span key={s} className="rounded-full bg-sunken px-2 py-0.5 text-[12px] text-ink-2">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                    {u.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {u.location}
                      </span>
                    )}
                    {u.role === "member" && challengeCount > 0 && <span>{plural(challengeCount, "desafio", "desafios")}</span>}
                    {u.role === "member" && projectCount > 0 && <span>{plural(projectCount, "projecto", "projectos")}</span>}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={res.page} pages={res.pages} total={res.total} label="membros" href={(n) => `/members?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`} />
    </div>
  );
}
