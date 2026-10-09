import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PostCard, PostRow } from "@/components/domain";
import { Card, CardHeader, EmptyState, PageHeader, Pagination, Tabs } from "@/components/ui";
import type { PostKind } from "@/db/schema";
import { challengePhase } from "@/lib/challenge-state";
import { POINT_RULES } from "@/lib/points";
import { listChallenges } from "@/server/challenges";
import { listFeed } from "@/server/community";
import { requireUser } from "@/server/session";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "Comunidade" };

const FILTERS: { key: string; label: string; kind?: PostKind }[] = [
  { key: "all", label: "Tudo" },
  { key: "announcement", label: "Anúncios", kind: "announcement" },
  { key: "discussion", label: "Discussões", kind: "discussion" },
  { key: "question", label: "Perguntas", kind: "question" },
  { key: "progress", label: "Progresso", kind: "progress" },
];

export default async function CommunityPage(props: PageProps<"/community">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  const page = Number(sp.page) || 1;
  const feed = await listFeed(user, { kind: f.kind, page });
  const challenges = (await listChallenges(user)).filter((c) => c.status !== "draft");
  const announcements = await listFeed(user, { kind: "announcement", limit: 3 });

  return (
    <div>
      <PageHeader title="Comunidade" description="Perguntas, progresso e anúncios oficiais. Partilhe o que está a construir." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Composer name={user.name} hue={user.avatarHue} canAnnounce={user.role === "investor"} challenges={challenges.map((c) => ({ id: c.id, title: c.title }))} />
          <Tabs active={f.key} items={FILTERS.map((x) => ({ key: x.key, label: x.label, href: x.key === "all" ? "/community" : `/community?f=${x.key}` }))} />
          {feed.items.length === 0 ? (
            <Card>
              <EmptyState icon={<MessagesSquare className="size-5" />} title="Ainda nada por aqui">Seja o primeiro a publicar.</EmptyState>
            </Card>
          ) : (
            feed.items.map((item) => <PostCard key={item.post.id} item={item} />)
          )}
          <Pagination page={feed.page} pages={feed.pages} href={(n) => `/community?${new URLSearchParams({ ...(f.kind ? { f: f.key } : {}), page: String(n) })}`} />
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader title="Anúncios oficiais" />
            <div className="divide-y divide-line/70">
              {announcements.items.map((a) => (
                <PostRow key={a.post.id} item={a} />
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Desafios activos" />
            <ul className="divide-y divide-line/70">
              {challenges
                .filter((c) => ["open", "upcoming"].includes(challengePhase(c)))
                .map((c) => (
                  <li key={c.id}>
                    <Link href={`/challenges/${c.slug}`} className="block px-5 py-3 text-sm font-medium hover:bg-sunken/50 hover:underline">
                      {c.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
          <Card className="p-5 text-[13px] text-ink-2">
            <h3 className="mb-1 text-sm font-semibold text-ink">Boas práticas</h3>
            Publicações valem {POINT_RULES.post} pontos e comentários {POINT_RULES.comment}, até {POINT_RULES.communityDailyCap} por dia. Reacções servem para reconhecer — não contam para classificações.
          </Card>
        </aside>
      </div>
    </div>
  );
}
