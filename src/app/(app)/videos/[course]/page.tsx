import { ArrowLeft, Check, Clock, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, cx, EmptyState, Notice, PageHeader } from "@/components/ui";
import { plural } from "@/lib/format";
import { DomainError } from "@/server/errors";
import { getCourse, LOCKED_MESSAGE } from "@/server/learning";
import { requireUser } from "@/server/session";

export async function generateMetadata(props: PageProps<"/videos/[course]">): Promise<Metadata> {
  return { title: (await props.params).course.replace(/-/g, " ") };
}

export default async function CollectionPage(props: PageProps<"/videos/[course]">) {
  const user = await requireUser();
  const { course } = await props.params;
  let d;
  try {
    d = await getCourse(user, course);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return (
    <div className="space-y-5">
      <Link href="/videos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Vídeos</Link>
      <PageHeader title={d.course.title} description={d.course.description} />
      {d.locked && (
        <Notice tone="warn">
          <span className="inline-flex items-center gap-1.5 font-medium"><Lock className="size-4" /> Conteúdo exclusivo.</span> {LOCKED_MESSAGE}
        </Notice>
      )}
      {d.flat.length === 0 ? (
        <Card><EmptyState title="Sem vídeos nesta colecção">Os vídeos aparecem aqui quando forem publicados.</EmptyState></Card>
      ) : (
        d.outline
          .filter((m) => m.lessons.length)
          .map((m) => (
            <Card key={m.id}>
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{m.title}</h2>
                <span className="text-[12px] text-muted">{plural(m.lessons.length, "vídeo", "vídeos")}</span>
              </div>
              <ol className="divide-y divide-line/70">
                {m.lessons.map((l, i) => {
                  const row = (
                    <>
                      <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold", l.done ? "bg-ok text-white" : "bg-sunken text-muted")}>
                        {d.locked ? <Lock className="size-3.5" /> : l.done ? <Check className="size-4" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted"><Clock className="size-3.5" /> {l.durationMin} min</span>
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {d.locked ? (
                        <div className="flex items-center gap-3 px-5 py-3 text-muted">{row}</div>
                      ) : (
                        <Link href={`/videos/${course}/${l.slug}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken/50">{row}</Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Card>
          ))
      )}
    </div>
  );
}
