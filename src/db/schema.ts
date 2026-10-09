import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema principles (adapted from Juryza, MIT):
 * - Primary facts are stored; rankings, points and phases are derived on read.
 * - Uniqueness constraints carry the integrity rules (one participation per
 *   member per challenge, one submission per project per challenge, one
 *   evaluation per evaluator per submission).
 * - Participation, submission, evaluation, result (win), prize award and
 *   investment decision are separate facts: winning never implies funding.
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const ROLES = ["member", "evaluator", "investor"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  /**
   * Identity at the external auth provider (e.g. Supabase Auth user id).
   * Null for accounts managed by the local provider. Keeping the mapping here
   * means switching providers only re-links subjects; user ids never change.
   */
  authSubject: text("auth_subject").unique(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  role: text("role", { enum: ROLES }).notNull().default("member"),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  location: text("location").notNull().default(""),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  websiteUrl: text("website_url"),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  avatarHue: integer("avatar_hue").notNull().default(210),
  avatarFileId: uuid("avatar_file_id").references((): AnyPgColumn => files.id, { onDelete: "set null" }),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Local auth provider tables. They are keyed by the provider "subject", not by
// users.id, so the local provider is a self-contained identity store exactly
// like an external one (Supabase Auth, Auth0…). Unused when AUTH_PROVIDER is
// an external provider.

export const credentials = pgTable("auth_credentials", {
  subject: text("subject").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const passwordResets = pgTable("auth_password_resets", {
  id: text("id").primaryKey(), // sha256 of the emailed token
  subject: text("subject")
    .notNull()
    .references(() => credentials.subject, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

/** Failed sign-in attempts, for throttling (local provider). */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: id(),
    key: text("key").notNull(), // normalised email
    createdAt: createdAt(),
  },
  (t) => [index("auth_attempts_key").on(t.key, t.createdAt)],
);

/**
 * Stored files. The database keeps a provider-neutral key; URLs are resolved
 * at read time by the storage service, so changing provider never rewrites rows.
 */
export const files = pgTable("files", {
  id: id(),
  storageKey: text("storage_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  /** Uploader, for auditing. Deliberately not a foreign key: users → files already
   *  references this table, and a cycle would prevent ordered restores. */
  ownerId: uuid("owner_id"),
  createdAt: createdAt(),
});

export const sessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  subject: text("subject")
    .notNull()
    .references(() => credentials.subject, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
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

export const challenges = pgTable("challenges", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  objectives: jsonb("objectives").$type<string[]>().notNull().default([]),
  rules: jsonb("rules").$type<string[]>().notNull().default([]),
  submissionInstructions: text("submission_instructions").notNull().default(""),
  status: text("status", { enum: CHALLENGE_STATUSES }).notNull().default("draft"),
  startsAt: ts("starts_at").notNull(),
  submissionDeadline: ts("submission_deadline").notNull(),
  resultsDate: ts("results_date").notNull(),
  maxTeamSize: integer("max_team_size").notNull().default(5),
  /** Points awarded on result publication, by final rank (index 0 = 1st). */
  placementPoints: jsonb("placement_points")
    .$type<number[]>()
    .notNull()
    .default([300, 200, 100]),
  /** Whether participants and their projects are visible to other members. */
  participantsVisible: boolean("participants_visible").notNull().default(true),
  coverHue: integer("cover_hue").notNull().default(80),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id),
  publishedAt: ts("published_at"),
  resultsPublishedAt: ts("results_published_at"),
  createdAt: createdAt(),
});

export const criteria = pgTable("criteria", {
  id: id(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  weight: integer("weight").notNull().default(1),
  position: integer("position").notNull().default(0),
});

export const PRIZE_KINDS = ["prize", "investment", "recognition"] as const;
export type PrizeKind = (typeof PRIZE_KINDS)[number];

export const prizes = pgTable("prizes", {
  id: id(),
  challengeId: uuid("challenge_id")
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

export const projects = pgTable("projects", {
  id: id(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
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
  logoFileId: uuid("logo_file_id").references(() => files.id, { onDelete: "set null" }),
  websiteUrl: text("website_url"),
  demoUrl: text("demo_url"),
  repoUrl: text("repo_url"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const projectUpdates = pgTable("project_updates", {
  id: id(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const participations = pgTable(
  "participations",
  {
    id: id(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("participation_unique").on(t.challengeId, t.userId)],
);

export const SUBMISSION_STATUSES = ["submitted", "shortlisted", "not_selected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    submittedById: uuid("submitted_by_id")
      .notNull()
      .references(() => users.id),
    summary: text("summary").notNull(),
    details: text("details").notNull().default(""),
    deliverableUrl: text("deliverable_url").notNull(),
    videoUrl: text("video_url"),
    status: text("status", { enum: SUBMISSION_STATUSES }).notNull().default("submitted"),
    submittedAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("submission_unique").on(t.challengeId, t.projectId)],
);

export const evaluatorAssignments = pgTable(
  "evaluator_assignments",
  {
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    evaluatorId: uuid("evaluator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.evaluatorId] })],
);

export const evaluations = pgTable(
  "evaluations",
  {
    id: id(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    evaluatorId: uuid("evaluator_id")
      .notNull()
      .references(() => users.id),
    /** criterionId -> score 0..10 */
    scores: jsonb("scores").$type<Record<string, number>>().notNull(),
    feedback: text("feedback").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("evaluation_unique").on(t.submissionId, t.evaluatorId)],
);

/** Confirmed final placements for a challenge. Visible to members once published. */
export const results = pgTable(
  "results",
  {
    id: id(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    finalScore: doublePrecision("final_score"),
    prizeId: uuid("prize_id").references(() => prizes.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    decidedById: uuid("decided_by_id")
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
export const opportunities = pgTable("opportunities", {
  id: id(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  challengeId: uuid("challenge_id").references(() => challenges.id, { onDelete: "set null" }),
  status: text("status", { enum: OPPORTUNITY_STATUSES }).notNull().default("interest"),
  amount: text("amount").notNull().default(""),
  note: text("note").notNull().default(""),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Append-only history of decisions taken on challenges and opportunities. */
export const decisionLog = pgTable(
  "decision_log",
  {
    id: id(),
    challengeId: uuid("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
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

export const posts = pgTable(
  "posts",
  {
    id: id(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: POST_KINDS }).notNull().default("discussion"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    challengeId: uuid("challenge_id").references(() => challenges.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("posts_created").on(t.createdAt)],
);

export const comments = pgTable("comments", {
  id: id(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const reactions = pgTable(
  "reactions",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const courses = pgTable("courses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  level: text("level").notNull().default("Essencial"),
  coverHue: integer("cover_hue").notNull().default(40),
  position: integer("position").notNull().default(0),
});

export const modules = pgTable("modules", {
  id: id(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
});

export const lessons = pgTable("lessons", {
  id: id(),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  durationMin: integer("duration_min").notNull().default(5),
  position: integer("position").notNull().default(0),
});

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
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
export type StoredFile = typeof files.$inferSelect;
