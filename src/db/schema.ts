import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

/**
 * Schema principles (adapted from Juryza, MIT):
 * - Primary facts are stored; rankings, points and phases are derived on read.
 * - Uniqueness constraints carry the integrity rules (one participation per
 *   member per challenge, one submission per project per challenge, one
 *   evaluation per evaluator per submission).
 * - Participation, submission, evaluation, result (win), prize award and
 *   investment decision are separate facts: winning never implies funding.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const ROLES = ["member", "evaluator", "investor"] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  role: text("role", { enum: ROLES }).notNull().default("member"),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  location: text("location").notNull().default(""),
  skills: text("skills", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  websiteUrl: text("website_url"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  avatarHue: integer("avatar_hue").notNull().default(210),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export const CHALLENGE_STATUSES = [
  "draft",
  "published",
  "paused",
  "closed",
  "results_published",
] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const challenges = sqliteTable("challenges", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  objectives: text("objectives", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  rules: text("rules", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  submissionInstructions: text("submission_instructions").notNull().default(""),
  status: text("status", { enum: CHALLENGE_STATUSES }).notNull().default("draft"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  submissionDeadline: integer("submission_deadline", { mode: "timestamp_ms" }).notNull(),
  resultsDate: integer("results_date", { mode: "timestamp_ms" }).notNull(),
  maxTeamSize: integer("max_team_size").notNull().default(5),
  /** Points awarded on result publication, by final rank (index 0 = 1st). */
  placementPoints: text("placement_points", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .default(sql`'[300,200,100]'`),
  /** Whether participants and their projects are visible to other members. */
  participantsVisible: integer("participants_visible", { mode: "boolean" }).notNull().default(true),
  coverHue: integer("cover_hue").notNull().default(80),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  resultsPublishedAt: integer("results_published_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const criteria = sqliteTable("criteria", {
  id: id(),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  weight: integer("weight").notNull().default(1),
  position: integer("position").notNull().default(0),
});

export const PRIZE_KINDS = ["prize", "investment", "recognition"] as const;
export type PrizeKind = (typeof PRIZE_KINDS)[number];

export const prizes = sqliteTable("prizes", {
  id: id(),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  /** Final rank this prize is reserved for (1 = winner). Null = discretionary. */
  rank: integer("rank"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  value: text("value").notNull().default(""),
  kind: text("kind", { enum: PRIZE_KINDS }).notNull().default("prize"),
  position: integer("position").notNull().default(0),
});

export const PROJECT_STAGES = ["idea", "prototype", "mvp", "traction", "scaling"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const projects = sqliteTable("projects", {
  id: id(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull().default(""),
  problem: text("problem").notNull().default(""),
  solution: text("solution").notNull().default(""),
  category: text("category").notNull(),
  stage: text("stage", { enum: PROJECT_STAGES }).notNull().default("idea"),
  logoHue: integer("logo_hue").notNull().default(160),
  websiteUrl: text("website_url"),
  demoUrl: text("demo_url"),
  repoUrl: text("repo_url"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const projectMembers = sqliteTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const projectUpdates = sqliteTable("project_updates", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const participations = sqliteTable(
  "participations",
  {
    id: id(),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("participation_unique").on(t.challengeId, t.userId)],
);

export const SUBMISSION_STATUSES = ["submitted", "shortlisted", "not_selected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const submissions = sqliteTable(
  "submissions",
  {
    id: id(),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    submittedById: text("submitted_by_id")
      .notNull()
      .references(() => users.id),
    summary: text("summary").notNull(),
    details: text("details").notNull().default(""),
    deliverableUrl: text("deliverable_url").notNull(),
    videoUrl: text("video_url"),
    status: text("status", { enum: SUBMISSION_STATUSES }).notNull().default("submitted"),
    submittedAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("submission_unique").on(t.challengeId, t.projectId)],
);

export const evaluatorAssignments = sqliteTable(
  "evaluator_assignments",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    evaluatorId: text("evaluator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.evaluatorId] })],
);

export const evaluations = sqliteTable(
  "evaluations",
  {
    id: id(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    evaluatorId: text("evaluator_id")
      .notNull()
      .references(() => users.id),
    /** criterionId -> score 0..10 */
    scores: text("scores", { mode: "json" }).$type<Record<string, number>>().notNull(),
    feedback: text("feedback").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("evaluation_unique").on(t.submissionId, t.evaluatorId)],
);

/** Confirmed final placements for a challenge. Visible to members once published. */
export const results = sqliteTable(
  "results",
  {
    id: id(),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    finalScore: real("final_score"),
    prizeId: text("prize_id").references(() => prizes.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    decidedById: text("decided_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("result_submission_unique").on(t.challengeId, t.submissionId),
    uniqueIndex("result_rank_unique").on(t.challengeId, t.rank),
  ],
);

export const OPPORTUNITY_STATUSES = [
  "interest",
  "due_diligence",
  "term_sheet",
  "invested",
  "declined",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** Investment pipeline. Independent from results: a win is not a funding decision. */
export const opportunities = sqliteTable("opportunities", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  challengeId: text("challenge_id").references(() => challenges.id, { onDelete: "set null" }),
  status: text("status", { enum: OPPORTUNITY_STATUSES }).notNull().default("interest"),
  amount: text("amount").notNull().default(""),
  note: text("note").notNull().default(""),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Append-only history of decisions taken on challenges and opportunities. */
export const decisionLog = sqliteTable(
  "decision_log",
  {
    id: id(),
    challengeId: text("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("decision_log_challenge").on(t.challengeId, t.createdAt)],
);

export const POST_KINDS = ["discussion", "announcement", "progress", "question"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const posts = sqliteTable(
  "posts",
  {
    id: id(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: POST_KINDS }).notNull().default("discussion"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    challengeId: text("challenge_id").references(() => challenges.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("posts_created").on(t.createdAt)],
);

export const comments = sqliteTable("comments", {
  id: id(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const reactions = sqliteTable(
  "reactions",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const courses = sqliteTable("courses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  level: text("level").notNull().default("Essencial"),
  coverHue: integer("cover_hue").notNull().default(40),
  position: integer("position").notNull().default(0),
});

export const modules = sqliteTable("modules", {
  id: id(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
});

export const lessons = sqliteTable("lessons", {
  id: id(),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  durationMin: integer("duration_min").notNull().default(5),
  position: integer("position").notNull().default(0),
});

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export type User = typeof users.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type Criterion = typeof criteria.$inferSelect;
export type Prize = typeof prizes.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Evaluation = typeof evaluations.$inferSelect;
export type Result = typeof results.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Post = typeof posts.$inferSelect;
