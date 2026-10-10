import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { challenges, users, type User } from "@/db/schema";
import { evaluatorOverview } from "../admin";
import { createChallenge, getChallengeBySlug, listChallenges, setChallengeStatus, setEvaluator, updateChallenge } from "../challenges";
import { createPost } from "../community";
import { DomainError } from "../errors";
import { leaderboard } from "../leaderboard";
import { enroll, submitProject } from "../participation";
import { createProject } from "../projects";
import { confirmResults, getSubmissionForReview, publishResults, reviewBoard, saveEvaluation, upsertOpportunity } from "../review";

const mk = async (role: User["role"], handle: string) =>
  (await db.insert(users).values({ email: `${handle}@t.test`, authSubject: `s-${handle}`, name: handle, handle, role }).returning())[0];

/** Run fn and return the DomainError code, or "ok". */
const code = async (fn: () => unknown) => {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DomainError) return e.code;
    throw e;
  }
  return "ok";
};

let investor: User, evaluator: User, evaluator2: User, outsiderEval: User, alice: User, bob: User;
let challengeId: string;
let slug: string;
let criteriaIds: string[];

const input = (over: Record<string, unknown> = {}) => ({
  title: "Desafio de teste",
  tagline: "Uma frase suficientemente longa.",
  description: "Descrição com mais de vinte caracteres.",
  category: "Teste",
  objectives: ["Objectivo"],
  rules: ["Regra"],
  submissionInstructions: "Instruções de submissão.",
  startsAt: new Date(Date.now() - 864e5).toISOString(),
  submissionDeadline: new Date(Date.now() + 10 * 864e5).toISOString(),
  resultsDate: new Date(Date.now() + 20 * 864e5).toISOString(),
  maxTeamSize: 2,
  placementPoints: [300, 200],
  participantsVisible: true,
  coverHue: 100,
  criteria: [
    { name: "Problema", description: "", weight: 3 },
    { name: "Equipa", description: "", weight: 1 },
  ],
  prizes: [{ rank: 1, title: "1.º lugar", value: "€1.000", description: "", kind: "prize" }],
  ...over,
});

const project = (name: string) => ({ name, tagline: `Projecto ${name} de teste`, category: "Teste", stage: "mvp", logoHue: 10, websiteUrl: "", demoUrl: "", repoUrl: "" });

beforeAll(async () => {
  investor = await mk("investor", "inv");
  evaluator = await mk("evaluator", "eva");
  evaluator2 = await mk("evaluator", "eva2");
  outsiderEval = await mk("evaluator", "out");
  alice = await mk("member", "alice");
  bob = await mk("member", "bob");
});

describe("challenge lifecycle", () => {
  it("only investors create challenges, which start as hidden drafts", async () => {
    expect(await code(() => createChallenge(alice, input()))).toBe("forbidden");
    expect(await code(() => createChallenge(investor, input({ criteria: [] })))).toBe("invalid");
    const c = await createChallenge(investor, input());
    challengeId = c.id;
    slug = c.slug;
    expect(c.status).toBe("draft");
    expect((await listChallenges(alice)).some((x) => x.id === c.id)).toBe(false);
    expect(await code(() => getChallengeBySlug(slug, alice))).toBe("not_found");
    expect(await code(() => enroll(alice, challengeId))).toBe("not_found");
  });

  it("rejects inconsistent dates and malformed ids", async () => {
    expect(await code(() => createChallenge(investor, input({ submissionDeadline: new Date(Date.now() - 2 * 864e5).toISOString() })))).toBe("invalid");
    expect(await code(() => setChallengeStatus(investor, "not-a-uuid", "published"))).toBe("not_found");
    expect(await code(() => enroll(alice, "../../etc"))).toBe("not_found");
  });

  it("publishes and enforces transitions", async () => {
    expect(await code(() => setChallengeStatus(investor, challengeId, "closed"))).toBe("conflict");
    await setChallengeStatus(investor, challengeId, "published");
    expect((await getChallengeBySlug(slug, alice)).phase).toBe("open");
  });
});

describe("participation and submission", () => {
  it("lets members enrol once and submit their own project", async () => {
    await enroll(alice, challengeId);
    await enroll(alice, challengeId); // idempotent
    expect((await getChallengeBySlug(slug, alice)).participantCount).toBe(1);
    expect(await code(() => enroll(investor, challengeId))).toBe("forbidden");

    const p = await createProject(alice, project("Alpha"));
    const sub = { projectId: p.id, summary: "Resumo com mais de vinte caracteres.", deliverableUrl: "https://example.com", videoUrl: "" };
    expect(await code(() => submitProject(bob, challengeId, sub))).toBe("forbidden");
    expect(await code(() => submitProject(alice, challengeId, { ...sub, deliverableUrl: "not a url" }))).toBe("invalid");
    expect((await submitProject(alice, challengeId, sub)).updated).toBe(false);
    expect((await submitProject(alice, challengeId, { ...sub, summary: "Resumo actualizado com mais caracteres." })).updated).toBe(true);

    const pb = await createProject(bob, project("Beta"));
    await submitProject(bob, challengeId, { ...sub, projectId: pb.id }); // auto-enrols
    expect((await getChallengeBySlug(slug, bob)).viewerParticipation).not.toBeNull();
  });

  it("blocks submissions while paused", async () => {
    await setChallengeStatus(investor, challengeId, "paused");
    const pid = (await reviewBoard(investor, challengeId)).rows[0].project.id;
    expect(await code(() => submitProject(alice, challengeId, { projectId: pid, summary: "Resumo com mais de vinte caracteres.", deliverableUrl: "https://example.com" }))).toBe("conflict");
    await setChallengeStatus(investor, challengeId, "published");
  });
});

describe("evaluation and results", () => {
  it("restricts evaluation to the investor and assigned evaluators", async () => {
    const board = await reviewBoard(investor, challengeId);
    criteriaIds = board.criteria.map((c) => c.id);
    const alpha = board.rows.find((r) => r.project.name === "Alpha")!;
    const scores = { [criteriaIds[0]]: 8, [criteriaIds[1]]: 4 };
    expect(await code(() => saveEvaluation(outsiderEval, alpha.submission.id, { scores }))).toBe("forbidden");
    expect(await code(() => saveEvaluation(alice, alpha.submission.id, { scores }))).toBe("forbidden");
    expect(await code(() => reviewBoard(outsiderEval, challengeId))).toBe("forbidden");
    await setEvaluator(investor, challengeId, evaluator.id, true);
    await setEvaluator(investor, challengeId, evaluator2.id, true);
    expect(await saveEvaluation(evaluator, alpha.submission.id, { scores })).toBe(70);
    expect(await code(() => saveEvaluation(evaluator, alpha.submission.id, { scores: { [criteriaIds[0]]: 8 } }))).toBe("invalid");
    expect(await saveEvaluation(evaluator2, alpha.submission.id, { scores: { [criteriaIds[0]]: 2, [criteriaIds[1]]: 2 }, feedback: "privado" })).toBe(20);
    expect(await saveEvaluation(investor, alpha.submission.id, { scores: { [criteriaIds[0]]: 10, [criteriaIds[1]]: 10 } })).toBe(100);
    const beta = (await reviewBoard(investor, challengeId)).rows.find((r) => r.project.name === "Beta")!;
    await saveEvaluation(investor, beta.submission.id, { scores: { [criteriaIds[0]]: 5, [criteriaIds[1]]: 5 }, feedback: "Bom começo." });
    const full = await reviewBoard(investor, challengeId);
    expect(full.rows.map((r) => [r.project.name, r.score, r.rank])).toEqual([["Alpha", 63.3], ["Beta", 50]].map(([n, s], i) => [n, s, i + 1]));
  });

  it("never exposes colleagues' scores, aggregates or history to an evaluator", async () => {
    const board = await reviewBoard(evaluator, challengeId);
    for (const r of board.rows) {
      expect(r.evaluations.every((e) => e.evaluatorId === evaluator.id)).toBe(true);
      expect(r.rank).toBeNull();
    }
    const alpha = board.rows.find((r) => r.project.name === "Alpha")!;
    expect(alpha.score).toBe(70); // own score only, not the 63.3 average
    expect(board.history).toEqual([]);
    expect(board.confirmed).toEqual([]);
    const detail = await getSubmissionForReview(evaluator, alpha.submission.id);
    expect(JSON.stringify(detail)).not.toContain("privado");
    const overview = await evaluatorOverview(evaluator);
    const row = overview.find((r) => r.id === challengeId)!;
    expect(row.evaluationsDone).toBe(1); // own progress, not the team's
  });

  it("locks criteria structure once evaluations exist", async () => {
    expect(await code(() => updateChallenge(investor, challengeId, input({ criteria: [{ name: "Novo", description: "", weight: 1 }] })))).toBe("invalid");
  });

  it("requires closing before confirming, confirming before publishing, and keeps results confidential", async () => {
    const rows = (await reviewBoard(investor, challengeId)).rows;
    const placements = rows.map((r) => ({ submissionId: r.submission.id, rank: r.rank!, prizeId: null, note: "" }));
    expect(await code(() => confirmResults(investor, challengeId, { placements }))).toBe("conflict");
    await setChallengeStatus(investor, challengeId, "closed");
    expect(await code(() => publishResults(investor, challengeId))).toBe("conflict");
    expect(await code(() => confirmResults(investor, challengeId, { placements: placements.map((p) => ({ ...p, rank: 1 })) }))).toBe("invalid");
    expect(await code(() => confirmResults(alice, challengeId, { placements }))).toBe("forbidden");
    await confirmResults(investor, challengeId, { placements });
    // Not visible to members nor to evaluators until published.
    expect((await getChallengeBySlug(slug, bob)).results).toEqual([]);
    expect((await getChallengeBySlug(slug, evaluator)).results).toEqual([]);
    expect(await leaderboard("merit")).toEqual([]);
    await publishResults(investor, challengeId);
    const [c] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
    expect(c.status).toBe("results_published");
    expect((await getChallengeBySlug(slug, bob)).results.map((r) => r.projectName)).toEqual(["Alpha", "Beta"]);
    expect(await code(() => publishResults(investor, challengeId))).toBe("conflict");
  });

  it("awards merit only from published results and keeps funding separate", async () => {
    const merit = await leaderboard("merit");
    expect(merit[0]).toMatchObject({ handle: "alice", merit: 63 + 300 });
    expect(merit[1]).toMatchObject({ handle: "bob", merit: 50 + 200 });
    const alpha = (await reviewBoard(investor, challengeId)).rows[0];
    expect(await code(() => saveEvaluation(investor, alpha.submission.id, { scores: { [criteriaIds[0]]: 1, [criteriaIds[1]]: 1 } }))).toBe("conflict");
    expect(await code(() => upsertOpportunity(alice, { projectId: alpha.project.id, status: "interest" }))).toBe("forbidden");
    expect(typeof (await upsertOpportunity(investor, { projectId: alpha.project.id, challengeId, status: "interest" }))).toBe("string");
  });
});

describe("community", () => {
  it("reserves announcements for the investor", async () => {
    expect(await code(() => createPost(alice, { kind: "announcement", title: "Olá", body: "Texto" }))).toBe("forbidden");
    expect(await code(() => createPost(alice, { kind: "discussion", title: "Olá", body: "Texto" }))).toBe("ok");
  });
});

describe("database security", () => {
  it("has row level security enabled on every public table", async () => {
    const rows = await db.execute<{ relname: string; relrowsecurity: boolean }>(
      sql`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`,
    );
    const list = (Array.isArray(rows) ? rows : (rows as { rows: { relname: string; relrowsecurity: boolean }[] }).rows) as { relname: string; relrowsecurity: boolean }[];
    expect(list.length).toBeGreaterThan(20);
    expect(list.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });
});
