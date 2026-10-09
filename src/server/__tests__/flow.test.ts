import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { challenges, users, type User } from "@/db/schema";
import { createChallenge, getChallengeBySlug, listChallenges, setChallengeStatus, setEvaluator, updateChallenge } from "../challenges";
import { createPost } from "../community";
import { DomainError } from "../errors";
import { leaderboard } from "../leaderboard";
import { enroll, submitProject } from "../participation";
import { createProject } from "../projects";
import { confirmResults, publishResults, reviewBoard, saveEvaluation, upsertOpportunity } from "../review";

const mk = (role: User["role"], handle: string) =>
  db.insert(users).values({ email: `${handle}@t.test`, passwordHash: "x", name: handle, handle, role }).returning().get();

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof DomainError) return e.code;
    throw e;
  }
  return "ok";
};

let investor: User, evaluator: User, outsiderEval: User, alice: User, bob: User;
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

beforeAll(() => {
  investor = mk("investor", "inv");
  evaluator = mk("evaluator", "eva");
  outsiderEval = mk("evaluator", "out");
  alice = mk("member", "alice");
  bob = mk("member", "bob");
});

describe("challenge lifecycle", () => {
  it("only investors create challenges, which start as hidden drafts", () => {
    expect(code(() => createChallenge(alice, input()))).toBe("forbidden");
    expect(code(() => createChallenge(investor, input({ criteria: [] })))).toBe("invalid");
    const c = createChallenge(investor, input());
    challengeId = c.id;
    slug = c.slug;
    expect(c.status).toBe("draft");
    expect(listChallenges(alice).some((x) => x.id === c.id)).toBe(false);
    expect(code(() => getChallengeBySlug(slug, alice))).toBe("not_found");
    expect(code(() => enroll(alice, challengeId))).toBe("not_found");
  });

  it("rejects inconsistent dates", () => {
    const r = code(() => createChallenge(investor, input({ submissionDeadline: new Date(Date.now() - 2 * 864e5).toISOString() })));
    expect(r).toBe("invalid");
  });

  it("publishes and enforces transitions", () => {
    expect(code(() => setChallengeStatus(investor, challengeId, "closed"))).toBe("conflict");
    setChallengeStatus(investor, challengeId, "published");
    expect(getChallengeBySlug(slug, alice).phase).toBe("open");
  });
});

describe("participation and submission", () => {
  it("lets members enrol once and submit their own project", () => {
    enroll(alice, challengeId);
    enroll(alice, challengeId); // idempotent
    expect(getChallengeBySlug(slug, alice).participantCount).toBe(1);
    expect(code(() => enroll(investor, challengeId))).toBe("forbidden");

    const p = createProject(alice, { name: "Alpha", tagline: "Projecto alfa de teste", category: "Teste", stage: "mvp", logoHue: 10, websiteUrl: "", demoUrl: "", repoUrl: "" });
    const sub = { projectId: p.id, summary: "Resumo com mais de vinte caracteres.", deliverableUrl: "https://example.com", videoUrl: "" };
    expect(code(() => submitProject(bob, challengeId, sub))).toBe("forbidden");
    expect(code(() => submitProject(alice, challengeId, { ...sub, deliverableUrl: "not a url" }))).toBe("invalid");
    expect(submitProject(alice, challengeId, sub).updated).toBe(false);
    expect(submitProject(alice, challengeId, { ...sub, summary: "Resumo actualizado com mais caracteres." }).updated).toBe(true);

    const pb = createProject(bob, { name: "Beta", tagline: "Projecto beta de teste", category: "Teste", stage: "idea", logoHue: 50, websiteUrl: "", demoUrl: "", repoUrl: "" });
    submitProject(bob, challengeId, { ...sub, projectId: pb.id }); // auto-enrols
    expect(getChallengeBySlug(slug, bob).viewerParticipation).not.toBeNull();
  });

  it("blocks submissions while paused", () => {
    setChallengeStatus(investor, challengeId, "paused");
    const pid = reviewBoard(investor, challengeId).rows[0].project.id;
    expect(code(() => submitProject(alice, challengeId, { projectId: pid, summary: "Resumo com mais de vinte caracteres.", deliverableUrl: "https://example.com" }))).toBe("conflict");
    setChallengeStatus(investor, challengeId, "published");
  });
});

describe("evaluation and results", () => {
  it("restricts evaluation to the investor and assigned evaluators", () => {
    criteriaIds = reviewBoard(investor, challengeId).criteria.map((c) => c.id);
    const [alpha] = reviewBoard(investor, challengeId).rows.filter((r) => r.project.name === "Alpha");
    const scores = { [criteriaIds[0]]: 8, [criteriaIds[1]]: 4 };
    expect(code(() => saveEvaluation(outsiderEval, alpha.submission.id, { scores }))).toBe("forbidden");
    expect(code(() => saveEvaluation(alice, alpha.submission.id, { scores }))).toBe("forbidden");
    setEvaluator(investor, challengeId, evaluator.id, true);
    expect(saveEvaluation(evaluator, alpha.submission.id, { scores })).toBe(70);
    expect(code(() => saveEvaluation(evaluator, alpha.submission.id, { scores: { [criteriaIds[0]]: 8 } }))).toBe("invalid");
    expect(saveEvaluation(investor, alpha.submission.id, { scores: { [criteriaIds[0]]: 10, [criteriaIds[1]]: 10 } })).toBe(100);
    const beta = reviewBoard(investor, challengeId).rows.find((r) => r.project.name === "Beta")!;
    saveEvaluation(investor, beta.submission.id, { scores: { [criteriaIds[0]]: 5, [criteriaIds[1]]: 5 }, feedback: "Bom começo." });
    const board = reviewBoard(investor, challengeId);
    expect(board.rows.map((r) => [r.project.name, r.score, r.rank])).toEqual([["Alpha", 85, 1], ["Beta", 50, 2]]);
  });

  it("locks criteria structure once evaluations exist", () => {
    const r = code(() => updateChallenge(investor, challengeId, input({ criteria: [{ name: "Novo", description: "", weight: 1 }] })));
    expect(r).toBe("invalid");
  });

  it("requires closing before confirming, and confirming before publishing", () => {
    const rows = reviewBoard(investor, challengeId).rows;
    const placements = rows.map((r) => ({ submissionId: r.submission.id, rank: r.rank!, prizeId: null, note: "" }));
    expect(code(() => confirmResults(investor, challengeId, { placements }))).toBe("conflict");
    setChallengeStatus(investor, challengeId, "closed");
    expect(code(() => publishResults(investor, challengeId))).toBe("conflict");
    expect(code(() => confirmResults(investor, challengeId, { placements: placements.map((p) => ({ ...p, rank: 1 })) }))).toBe("invalid");
    expect(code(() => confirmResults(alice, challengeId, { placements }))).toBe("forbidden");
    confirmResults(investor, challengeId, { placements });
    // Not public until published.
    expect(getChallengeBySlug(slug, bob).results).toEqual([]);
    expect(leaderboard("merit")).toEqual([]);
    publishResults(investor, challengeId);
    expect(db.select().from(challenges).where(eq(challenges.id, challengeId)).get()!.status).toBe("results_published");
    expect(getChallengeBySlug(slug, bob).results.map((r) => r.projectName)).toEqual(["Alpha", "Beta"]);
  });

  it("awards merit only from published results and keeps funding separate", () => {
    const merit = leaderboard("merit");
    expect(merit[0]).toMatchObject({ handle: "alice", merit: 85 + 300 });
    expect(merit[1]).toMatchObject({ handle: "bob", merit: 50 + 200 });
    const alpha = reviewBoard(investor, challengeId).rows[0];
    expect(code(() => saveEvaluation(investor, alpha.submission.id, { scores: { [criteriaIds[0]]: 1, [criteriaIds[1]]: 1 } }))).toBe("conflict");
    expect(code(() => upsertOpportunity(alice, { projectId: alpha.project.id, status: "interest" }))).toBe("forbidden");
    expect(typeof upsertOpportunity(investor, { projectId: alpha.project.id, challengeId, status: "interest" })).toBe("string");
  });
});

describe("community", () => {
  it("reserves announcements for the investor", () => {
    expect(code(() => createPost(alice, { kind: "announcement", title: "Olá", body: "Texto" }))).toBe("forbidden");
    expect(code(() => createPost(alice, { kind: "discussion", title: "Olá", body: "Texto" }))).toBe("ok");
  });
});
