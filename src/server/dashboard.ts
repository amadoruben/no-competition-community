import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projectUpdates, type User } from "@/db/schema";
import { challengePhase } from "@/lib/challenge-state";
import { daysUntil } from "@/lib/format";
import { listChallenges } from "./challenges";
import { listFeed } from "./community";
import { leaderboard, memberPoints } from "./leaderboard";
import { projectsForUser } from "./projects";

export interface Todo {
  key: string;
  title: string;
  detail: string;
  href: string;
  urgent: boolean;
}

export function memberDashboard(user: User) {
  const challenges = listChallenges(user).map((c) => ({ ...c, phase: challengePhase(c) }));
  const mine = challenges.filter((c) => c.viewerEnrolled);
  const discover = challenges.filter((c) => !c.viewerEnrolled && (c.phase === "open" || c.phase === "upcoming"));
  const projects = projectsForUser(user.id);
  const lastUpdates = projects.length
    ? db
        .select({ projectId: projectUpdates.projectId, at: projectUpdates.createdAt })
        .from(projectUpdates)
        .where(inArray(projectUpdates.projectId, projects.map((p) => p.id)))
        .orderBy(desc(projectUpdates.createdAt))
        .all()
    : [];

  const todos: Todo[] = [];
  for (const c of mine) {
    if (c.phase === "open" && !c.viewerSubmitted) {
      const d = daysUntil(c.submissionDeadline);
      todos.push({
        key: `submit-${c.id}`,
        title: `Submeter a “${c.title}”`,
        detail: d <= 1 ? "O prazo termina hoje" : `Faltam ${d} dias para o prazo`,
        href: `/challenges/${c.slug}/submit`,
        urgent: d <= 5,
      });
    }
    if (c.phase === "upcoming")
      todos.push({ key: `prep-${c.id}`, title: `Preparar “${c.title}”`, detail: "O desafio abre em breve — reveja os critérios", href: `/challenges/${c.slug}`, urgent: false });
  }
  if (projects.length === 0)
    todos.push({ key: "project", title: "Criar o seu primeiro projecto", detail: "É o que vai submeter aos desafios", href: "/projects/new", urgent: false });
  for (const p of projects) {
    const last = lastUpdates.find((u) => u.projectId === p.id)?.at;
    if (!last || daysUntil(last) < -14)
      todos.push({ key: `update-${p.id}`, title: `Partilhar progresso de ${p.name}`, detail: last ? "Sem actualizações há mais de 2 semanas" : "Ainda sem actualizações", href: `/projects/${p.slug}#updates`, urgent: false });
  }

  const points = memberPoints(user.id);
  const board = leaderboard("overall", 1000);
  const myIndex = board.findIndex((r) => r.userId === user.id);
  const around = myIndex < 0 ? board.slice(0, 5) : board.slice(Math.max(0, myIndex - 2), Math.max(0, myIndex - 2) + 5);

  return {
    mine,
    discover,
    projects: projects.map((p) => ({ ...p, lastUpdate: lastUpdates.find((u) => u.projectId === p.id)?.at ?? null })),
    todos,
    points,
    around,
    feed: listFeed(user, { limit: 4 }),
  };
}
