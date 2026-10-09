"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { registerMember, verifyCredentials } from "@/server/auth";
import { createChallenge, setChallengeStatus, setEvaluator, updateChallenge } from "@/server/challenges";
import { addComment, createPost, setPinned, toggleReaction } from "@/server/community";
import { DomainError } from "@/server/errors";
import { setLessonComplete } from "@/server/learning";
import { updateProfile } from "@/server/members";
import { enroll, submitProject } from "@/server/participation";
import { addProjectMember, addProjectUpdate, createProject, updateProject } from "@/server/projects";
import { confirmResults, publishResults, saveEvaluation, setSubmissionStatus, upsertOpportunity } from "@/server/review";
import { currentUser, endSession, startSession } from "@/server/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function attempt(fn: () => unknown, message?: string): Promise<NonNullable<ActionState>> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true, message, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof DomainError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors, at: Date.now() };
    console.error(e);
    return { ok: false, error: "Ocorreu um erro inesperado. Tente novamente.", at: Date.now() };
  }
}

async function actor() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const optStr = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === null || v === "" ? null : String(v);
};

// Auth -------------------------------------------------------------------------

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let userId = "";
  const r = await attempt(() => {
    userId = verifyCredentials({ email: str(fd, "email"), password: str(fd, "password") }).id;
  });
  if (!r.ok) return r;
  await startSession(userId);
  redirect(safeNext(str(fd, "next")));
}

/** One-click sign-in for the clearly-labelled demo accounts. */
export async function demoLoginAction(fd: FormData) {
  const email = str(fd, "email");
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user?.isDemo) redirect("/login");
  await startSession(user.id);
  redirect(user.role === "investor" ? "/admin" : user.role === "evaluator" ? "/review" : "/dashboard");
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let userId = "";
  const r = await attempt(() => {
    userId = registerMember({ name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password") }).id;
  });
  if (!r.ok) return r;
  await startSession(userId);
  redirect("/dashboard?welcome=1");
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

// Challenges (investor) ------------------------------------------------------------

function challengePayload(fd: FormData) {
  return JSON.parse(str(fd, "payload") || "{}");
}

export async function createChallengeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  let id = "";
  const r = await attempt(() => {
    id = createChallenge(u, challengePayload(fd)).id;
  });
  if (!r.ok) return r;
  redirect(`/admin/challenges/${id}?created=1`);
}

export async function updateChallengeAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  const r = await attempt(() => updateChallenge(u, id, challengePayload(fd)));
  if (!r.ok) return r;
  redirect(`/admin/challenges/${id}?saved=1`);
}

export async function setChallengeStatusAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  const status = str(fd, "status");
  const msg = { published: "Desafio publicado.", paused: "Desafio em pausa.", closed: "Submissões encerradas." }[status];
  return attempt(() => setChallengeStatus(u, id, status), msg);
}

export async function setEvaluatorAction(challengeId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  const assigned = str(fd, "assigned") === "1";
  return attempt(() => setEvaluator(u, challengeId, str(fd, "evaluatorId"), assigned), assigned ? "Avaliador(a) atribuído(a)." : "Avaliador(a) removido(a).");
}

export async function setSubmissionStatusAction(submissionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  return attempt(() => setSubmissionStatus(u, submissionId, str(fd, "status")), "Estado actualizado.");
}

export async function confirmResultsAction(challengeId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  const placements = fd
    .getAll("submissionId")
    .map((sid) => String(sid))
    .map((sid) => ({
      submissionId: sid,
      rank: str(fd, `rank:${sid}`),
      prizeId: optStr(fd, `prize:${sid}`),
      note: str(fd, `note:${sid}`),
    }))
    .filter((p) => p.rank !== "");
  return attempt(() => confirmResults(u, challengeId, { placements }), "Resultados confirmados. Ainda não estão visíveis para os membros.");
}

export async function publishResultsAction(challengeId: string, _: ActionState): Promise<ActionState> {
  const u = await actor();
  return attempt(() => publishResults(u, challengeId), "Resultados publicados e anunciados à comunidade.");
}

export async function saveEvaluationAction(submissionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  const scores: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("score:")) scores[k.slice(6)] = String(v);
  let score: number | null = null;
  const r = await attempt(() => {
    score = saveEvaluation(u, submissionId, { scores, feedback: str(fd, "feedback") });
  });
  if (r.ok) r.message = `Avaliação guardada · nota ${String(score).replace(".", ",")}/100`;
  return r;
}

export async function opportunityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  const id = optStr(fd, "id") ?? undefined;
  return attempt(
    () =>
      upsertOpportunity(
        u,
        { projectId: str(fd, "projectId"), challengeId: optStr(fd, "challengeId"), status: str(fd, "status"), amount: str(fd, "amount"), note: str(fd, "note") },
        id,
      ),
    id ? "Oportunidade actualizada." : "Oportunidade registada.",
  );
}

// Members ----------------------------------------------------------------------------

export async function enrollAction(challengeId: string, _: ActionState): Promise<ActionState> {
  const u = await actor();
  return attempt(() => enroll(u, challengeId), "Inscrição confirmada. Bom trabalho!");
}

export async function submitProjectAction(challengeId: string, slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  let updated = false;
  const r = await attempt(() => {
    updated = submitProject(u, challengeId, {
      projectId: str(fd, "projectId"),
      summary: str(fd, "summary"),
      details: str(fd, "details"),
      deliverableUrl: str(fd, "deliverableUrl"),
      videoUrl: str(fd, "videoUrl"),
    }).updated;
  });
  if (!r.ok) return r;
  redirect(`/challenges/${slug}?${updated ? "updated" : "submitted"}=1`);
}

function projectFields(fd: FormData) {
  return {
    name: str(fd, "name"),
    tagline: str(fd, "tagline"),
    description: str(fd, "description"),
    problem: str(fd, "problem"),
    solution: str(fd, "solution"),
    category: str(fd, "category"),
    stage: str(fd, "stage"),
    logoHue: str(fd, "logoHue") || "160",
    websiteUrl: str(fd, "websiteUrl"),
    demoUrl: str(fd, "demoUrl"),
    repoUrl: str(fd, "repoUrl"),
  };
}

export async function createProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  let slug = "";
  const r = await attempt(() => {
    slug = createProject(u, projectFields(fd)).slug;
  });
  if (!r.ok) return r;
  const back = optStr(fd, "returnTo");
  redirect(back && back.startsWith("/challenges/") ? `${back}?project=${slug}` : `/projects/${slug}?created=1`);
}

export async function updateProjectAction(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  let slug = "";
  const r = await attempt(() => {
    slug = updateProject(u, projectId, projectFields(fd)).slug;
  });
  if (!r.ok) return r;
  redirect(`/projects/${slug}?saved=1`);
}

export async function projectUpdateAction(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  return attempt(
    () => addProjectUpdate(u, projectId, { title: str(fd, "title"), body: str(fd, "body"), shareToFeed: fd.get("shareToFeed") === "on" }),
    "Actualização publicada.",
  );
}

export async function addProjectMemberAction(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  return attempt(() => addProjectMember(u, projectId, { handle: str(fd, "handle"), title: str(fd, "title") }), "Membro adicionado à equipa.");
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  return attempt(
    () =>
      updateProfile(u, {
        name: str(fd, "name"),
        headline: str(fd, "headline"),
        bio: str(fd, "bio"),
        location: str(fd, "location"),
        skills: str(fd, "skills"),
        websiteUrl: str(fd, "websiteUrl"),
        linkedinUrl: str(fd, "linkedinUrl"),
        githubUrl: str(fd, "githubUrl"),
      }),
    "Perfil actualizado.",
  );
}

// Community ---------------------------------------------------------------------------

export async function createPostAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  return attempt(
    () =>
      createPost(u, {
        kind: str(fd, "kind") || "discussion",
        title: str(fd, "title"),
        body: str(fd, "body"),
        challengeId: optStr(fd, "challengeId"),
        projectId: optStr(fd, "projectId"),
      }),
    "Publicado.",
  );
}

export async function commentAction(postId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  return attempt(() => addComment(u, postId, str(fd, "body")));
}

export async function reactAction(postId: string) {
  const u = await actor();
  toggleReaction(u, postId);
  revalidatePath("/", "layout");
}

export async function pinAction(postId: string, pinned: boolean) {
  const u = await actor();
  await attempt(() => setPinned(u, postId, pinned));
}

export async function lessonAction(lessonId: string, complete: boolean) {
  const u = await actor();
  setLessonComplete(u, lessonId, complete);
  revalidatePath("/", "layout");
}
