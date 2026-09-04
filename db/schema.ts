import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "creator"]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
]);

export const platformEnum = pgEnum("platform", [
  "tiktok",
  "instagram",
  "youtube",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("creator"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  /** Allowed platforms for this campaign, e.g. ["tiktok","instagram"] */
  platforms: jsonb("platforms").$type<string[]>().notNull().default([]),
  /** Payout per 1,000 views in cents (e.g. 200 = €2.00) */
  payoutPer1kViews: integer("payout_per_1k_views").notNull(),
  /** Total campaign budget in cents */
  totalBudget: integer("total_budget").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Submissions ──────────────────────────────────────────────────────────────

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postUrl: text("post_url").notNull(),
    platform: platformEnum("platform").notNull(),
    status: submissionStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // A creator can only submit a given URL once per campaign
    uniqueSubmission: uniqueIndex("unique_submission_url").on(
      t.campaignId,
      t.postUrl
    ),
  })
);

// ─── Submission Metrics ───────────────────────────────────────────────────────

export const submissionMetrics = pgTable(
  "submission_metrics",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    /** ISO date string YYYY-MM-DD */
    capturedAt: text("captured_at").notNull(),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
  },
  (t) => ({
    // Only one metric snapshot per submission per day
    uniqueMetric: uniqueIndex("unique_submission_metric").on(
      t.submissionId,
      t.capturedAt
    ),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SubmissionMetric = typeof submissionMetrics.$inferSelect;
