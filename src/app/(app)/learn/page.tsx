import { BookOpen, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, Progress } from "@/components/ui";
import { listCourses } from "@/server/learning";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Aprender" };

export default async function LearnPage() {
  const user = await requireUser();
  const courses = await listCourses(user);
  return (
    <div>
      <PageHeader title="Aprender" description="Percursos curtos e práticos para chegar a cada desafio com um projecto mais forte." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const pct = c.lessonCount ? (c.completed / c.lessonCount) * 100 : 0;
          return (
            <Link key={c.id} href={`/learn/${c.slug}`} className="group">
              <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-pop)]">
                <div className="cover flex h-28 items-end p-4" style={{ ["--h" as string]: c.coverHue }}>
                  <BookOpen className="size-7 text-white/90" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="text-[12px] font-medium text-muted">{c.level}</div>
                  <h2 className="mt-1 font-display text-lg font-semibold group-hover:underline">{c.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-2">{c.description}</p>
                  <div className="mt-auto pt-4">
                    <div className="mb-1.5 flex justify-between text-[12px] text-muted">
                      <span className="flex items-center gap-1"><Clock className="size-3.5" />{c.lessonCount} aulas · {c.minutes} min</span>
                      <span className="tabular">{c.completed}/{c.lessonCount}</span>
                    </div>
                    <Progress value={pct} tone={pct === 100 ? "ok" : "ink"} />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
