"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { emailSchema, passwordSchema, resolveUser, validateRegistration } from "@/server/accounts";
import { auth, AuthError } from "@/server/auth";
import { createChallenge, setChallengeStatus, setEvaluator, updateChallenge } from "@/server/challenges";
import { addComment, createPost, setPinned, toggleReaction } from "@/server/community";
import { DomainError, invalid } from "@/server/errors";
import { UNAVAILABLE_MESSAGE, isInfraUnavailable } from "@/server/infra-errors";
import { setLessonComplete } from "@/server/learning";
import { logger } from "@/server/logger";
import { updateProfile } from "@/server/members";
import { enroll, submitProject } from "@/server/participation";
import { addProjectMember, addProjectUpdate, createProject, removeProjectMember, updateProject } from "@/server/projects";
import { confirmResults, publishResults, saveEvaluation, setSubmissionStatus, upsertOpportunity } from "@/server/review";
import { currentUser, homeFor } from "@/server/session";
import { parse } from "@/server/validation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEMO_PASSWORD } from "@/db/seed-data";
import { demoMode } from "@/server/config";
import { removeAvatar, removeProjectLogo, uploadAvatar, uploadProjectLogo } from "@/server/files";

/**
 * Runs a mutation and translates failures into form state.
 * Success is only reported after the service call has resolved — i.e. after
 * the transaction committed. Infrastructure failures say explicitly that
 * nothing was saved.
 */
async function attempt(fn: () => unknown, message?: string): Promise<NonNullable<ActionState>> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true, message, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof DomainError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors, at: Date.now() };
    if (e instanceof AuthError) return { ok: false, error: e.message, at: Date.now() };
    if (isInfraUnavailable(e)) {
      logger.error("action.unavailable", { error: e });
      return { ok: false, error: UNAVAILABLE_MESSAGE, at: Date.now() };
    }
    logger.error("action.failed", { error: e });
    return { ok: false, error: "Ocorreu um erro inesperado. Nada foi alterado. Tente novamente.", at: Date.now() };
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

async function origin() {
  const h = await headers();
  return process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

// Auth -------------------------------------------------------------------------

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest = "/dashboard";
  const r = await attempt(async () => {
    const { email, password } = parse(z.object({ email: emailSchema, password: z.string().min(1, "Indique a palavra-passe.") }), {
      email: str(fd, "email"),
      password: str(fd, "password"),
    });
    const identity = await auth().signIn(email, password);
    const user = await resolveUser(identity);
    dest = safeNext(str(fd, "next")) ?? homeFor(user);
  });
  if (!r.ok) return r;
  redirect(dest);
}

/** One-click sign-in for the clearly-labelled demo accounts (DEMO_MODE only). */
export async function demoLoginAction(fd: FormData) {
  if (!demoMode()) redirect("/login");
  const email = str(fd, "email");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.isDemo) redirect("/login");
  try {
    await auth().signIn(email, DEMO_PASSWORD);
  } catch (e) {
    unstable_rethrow(e);
    logger.error("auth.demo_login_failed", { error: e });
    redirect("/login?error=demo");
  }
  redirect(homeFor(user));
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest = "/dashboard?welcome=1";
  const r = await attempt(async () => {
    const v = await validateRegistration({ name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password") });
    const { identity, needsEmailConfirmation } = await auth().signUp(v.email, v.password);
    await resolveUser(identity, v.name);
    if (needsEmailConfirmation) dest = "/login?confirm=1";
  });
  if (!r.ok) return r;
  redirect(dest);
}

export async function logoutAction() {
  await auth().signOut();
  redirect("/");
}

export async function requestResetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const email = parse(z.object({ email: emailSchema }), { email: str(fd, "email") }).email;
    await auth().requestPasswordReset(email, `${await origin()}/reset-password`);
  }, "Se existir uma conta com este email, enviámos um link para definir uma nova palavra-passe.");
}

export async function completeResetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest = "/dashboard";
  const r = await attempt(async () => {
    const { password, confirm } = parse(z.object({ password: passwordSchema, confirm: z.string() }), { password: str(fd, "password"), confirm: str(fd, "confirm") });
    if (password !== confirm) throw invalid("As palavras-passe não coincidem.", { confirm: "As palavras-passe não coincidem." });
    const token = str(fd, "token");
    if (!token) throw invalid("Link inválido. Peça um novo.");
    const identity = await auth().completePasswordReset({ token, password });
    dest = homeFor(await resolveUser(identity));
  });
  if (!r.ok) return r;
  redirect(`${dest}${dest.includes("?") ? "&" : "?"}reset=1`);
}

// Challenges (investor) ------------------------------------------------------------

function challengePayload(fd: FormData) {
  try {
    return JSON.parse(str(fd, "payload") || "{}");
  } catch {
    return {};
  }
}

export async function createChallengeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  let id = "";
  const r = await attempt(async () => {
    id = (await createChallenge(u, challengePayload(fd))).id;
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
    .map((sid) => ({ submissionId: sid, rank: str(fd, `rank:${sid}`), prizeId: optStr(fd, `prize:${sid}`), note: str(fd, `note:${sid}`) }))
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
  const r = await attempt(async () => {
    score = await saveEvaluation(u, submissionId, { scores, feedback: str(fd, "feedback") });
  });
  if (r.ok) r.message = `Avaliação guardada · nota ${String(score).replace(".", ",")}/100`;
  return r;
}

export async function opportunityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  const id = optStr(fd, "id") ?? undefined;
  return attempt(
    () => upsertOpportunity(u, { projectId: str(fd, "projectId"), challengeId: optStr(fd, "challengeId"), status: str(fd, "status"), amount: str(fd, "amount"), note: str(fd, "note") }, id),
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
  const r = await attempt(async () => {
    updated = (
      await submitProject(u, challengeId, {
        projectId: str(fd, "projectId"),
        summary: str(fd, "summary"),
        details: str(fd, "details"),
        deliverableUrl: str(fd, "deliverableUrl"),
        videoUrl: str(fd, "videoUrl"),
      })
    ).updated;
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
  const r = await attempt(async () => {
    slug = (await createProject(u, projectFields(fd))).slug;
  });
  if (!r.ok) return r;
  const back = optStr(fd, "returnTo");
  redirect(back && /^\/challenges\/[\w-]+\/submit$/.test(back) ? `${back}?project=${slug}` : `/projects/${slug}?created=1`);
}

export async function updateProjectAction(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  let slug = "";
  const r = await attempt(async () => {
    slug = (await updateProject(u, projectId, projectFields(fd))).slug;
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

export async function removeProjectMemberAction(projectId: string, userId: string, _: ActionState): Promise<ActionState> {
  const u = await actor();
  return attempt(() => removeProjectMember(u, projectId, userId), "Membro removido da equipa.");
}

export async function projectLogoAction(projectId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  if (fd.get("remove") === "1") return attempt(() => removeProjectLogo(u, projectId), "Logótipo removido.");
  return attempt(() => uploadProjectLogo(u, projectId, fd.get("file")), "Logótipo actualizado.");
}

export async function avatarAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  if (fd.get("remove") === "1") return attempt(() => removeAvatar(u), "Fotografia removida.");
  return attempt(() => uploadAvatar(u, fd.get("file")), "Fotografia actualizada.");
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
    () => createPost(u, { kind: str(fd, "kind") || "discussion", title: str(fd, "title"), body: str(fd, "body"), challengeId: optStr(fd, "challengeId"), projectId: optStr(fd, "projectId") }),
    "Publicado.",
  );
}

export async function commentAction(postId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await actor();
  return attempt(() => addComment(u, postId, str(fd, "body")), "Comentário publicado.");
}

/** Returns the persisted state so optimistic UI can reconcile (or roll back on failure). */
export async function reactAction(postId: string): Promise<{ ok: boolean; active?: boolean; error?: string }> {
  const u = await actor();
  let active = false;
  const r = await attempt(async () => {
    active = await toggleReaction(u, postId);
  });
  return r.ok ? { ok: true, active } : { ok: false, error: r.error };
}

export async function pinAction(postId: string, pinned: boolean) {
  const u = await actor();
  return attempt(() => setPinned(u, postId, pinned));
}

export async function lessonAction(lessonId: string, complete: boolean) {
  const u = await actor();
  return attempt(() => setLessonComplete(u, lessonId, complete), complete ? "Aula concluída." : undefined);
}
