import { TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import {
  campaigns,
  submissions,
  submissionMetrics,
} from "@/db/schema";
import type { Database } from "@/db";
import { ErrorCodes } from "@/lib/errors";

/**
 * Calculate payout for a given number of views.
 * Formula: floor(views / 1000) * payoutPer1kViews
 * Both values are in cents.
 */
export function calculatePayout(views: number, payoutPer1kViews: number): number {
  return Math.floor(views / 1000) * payoutPer1kViews;
}

/**
 * Get the latest (most recent) metric for a submission.
 */
export async function getLatestMetric(
  db: Database,
  submissionId: string
): Promise<{ views: number; likes: number; comments: number } | null> {
  const result = await db
    .select()
    .from(submissionMetrics)
    .where(eq(submissionMetrics.submissionId, submissionId))
    .orderBy(sql`${submissionMetrics.capturedAt} DESC`)
    .limit(1);

  return result[0] ?? null;
}

/**
 * Calculate total amount already spent on approved submissions for a campaign.
 * Returns amount in cents.
 */
export async function getCampaignSpent(
  db: Database,
  campaignId: string
): Promise<number> {
  // Get all approved submissions for this campaign
  const approvedSubs = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.campaignId, campaignId),
        eq(submissions.status, "approved")
      )
    );

  if (approvedSubs.length === 0) return 0;

  // Get the campaign payout rate
  const campaign = await db
    .select({ payoutPer1kViews: campaigns.payoutPer1kViews })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign[0]) return 0;

  const payoutRate = campaign[0].payoutPer1kViews;
  
  const subIds = approvedSubs.map((s) => s.id);

  // N+1 FIX: Get latest metric for all approved submissions in one query
  const rawLatestMetrics = await db.execute<{ views: number }>(sql`
    SELECT DISTINCT ON (submission_id) views
    FROM submission_metrics
    WHERE submission_id IN (${sql.join(subIds, sql`, `)})
    ORDER BY submission_id, captured_at DESC
  `);

  let totalSpent = 0;
  for (const row of rawLatestMetrics) {
    totalSpent += calculatePayout(row.views, payoutRate);
  }

  return totalSpent;
}

/**
 * Atomically approve a submission, enforcing budget ceiling.
 *
 * Uses SELECT ... FOR UPDATE to lock the campaign row, preventing race
 * conditions when two admins approve submissions simultaneously.
 *
 * The full flow:
 *  1. Lock the campaign row (FOR UPDATE)
 *  2. Fetch latest metric for the target submission
 *  3. Calculate the new earning
 *  4. Sum all existing approved submission earnings
 *  5. Check if (spent + newEarning) > totalBudget → throw BUDGET_EXCEEDED
 *  6. Update submission status to "approved"
 *  7. If budget is now at or over the ceiling → mark campaign "completed"
 */
export async function approveSubmissionAtomic(
  db: Database,
  submissionId: string
): Promise<{ success: true; earning: number; budgetExhausted: boolean }> {
  return await db.transaction(async (tx) => {
    // 1. Load and lock the submission first (to get campaignId)
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
    }

    if (submission.status !== "pending") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Submission is already ${submission.status}`,
      });
    }

    // 2. Lock the campaign row to prevent concurrent budget mutations
    const [campaign] = await tx.execute<{
      id: string;
      total_budget: number;
      payout_per_1k_views: number;
      status: string;
    }>(
      sql`SELECT id, total_budget, payout_per_1k_views, status FROM campaigns WHERE id = ${submission.campaignId} FOR UPDATE`
    );

    if (!campaign) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    }

    if (campaign.status === "completed") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Campaign budget has been fully allocated",
      });
    }

    // 3. Get latest metric for this submission
    const [latestMetric] = await tx
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submissionId))
      .orderBy(sql`${submissionMetrics.capturedAt} DESC`)
      .limit(1);

    const views = latestMetric?.views ?? 0;
    const newEarning = calculatePayout(views, campaign.payout_per_1k_views);

    // 4. Sum all already-approved submissions for this campaign
    const approvedSubs = await tx
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.campaignId, submission.campaignId),
          eq(submissions.status, "approved")
        )
      );

    let currentSpent = 0;
    
    if (approvedSubs.length > 0) {
      const subIds = approvedSubs.map((s) => s.id);
      
      const rawLatestMetrics = await tx.execute<{ views: number }>(sql`
        SELECT DISTINCT ON (submission_id) views
        FROM submission_metrics
        WHERE submission_id IN (${sql.join(subIds, sql`, `)})
        ORDER BY submission_id, captured_at DESC
      `);

      for (const row of rawLatestMetrics) {
        currentSpent += calculatePayout(row.views, campaign.payout_per_1k_views);
      }
    }

    // 5. Budget ceiling check
    if (currentSpent + newEarning > campaign.total_budget) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: ErrorCodes.BUDGET_EXCEEDED,
      });
    }

    // 6. Mark submission as approved
    await tx
      .update(submissions)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(submissions.id, submissionId));

    // 7. Auto-complete campaign if budget exhausted
    const budgetExhausted = currentSpent + newEarning >= campaign.total_budget;
    if (budgetExhausted) {
      await tx
        .update(campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(campaigns.id, submission.campaignId));
    }

    return { success: true, earning: newEarning, budgetExhausted };
  });
}
