import { z } from "zod";
import { router, adminProcedure, creatorProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  campaigns,
  submissions,
  submissionMetrics,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  submitClipSchema,
  rejectSubmissionSchema,
  approveSubmissionSchema,
} from "@/lib/validations";
import { approveSubmissionAtomic } from "../services/payout";
import { nanoid } from "nanoid";

export const submissionRouter = router({
  // ─── Submit a clip (creator only) ──────────────────────────────────────────
  submitClip: creatorProcedure
    .input(submitClipSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify campaign exists and is active
      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }
      if (campaign.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Campaign is not currently accepting submissions",
        });
      }

      // Verify platform is allowed in this campaign
      if (!campaign.platforms.includes(input.platform)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Platform "${input.platform}" is not accepted for this campaign`,
        });
      }

      // Explicit duplicate URL check: The same URL cannot end up on the same campaign twice
      const [duplicate] = await ctx.db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, input.campaignId),
            eq(submissions.postUrl, input.postUrl)
          )
        )
        .limit(1);

      if (duplicate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This post URL has already been submitted to this campaign",
        });
      }

      const id = nanoid();
      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          id,
          campaignId: input.campaignId,
          creatorId: ctx.user.id,
          postUrl: input.postUrl,
          platform: input.platform,
          status: "pending",
        })
        .returning();

      return submission;
    }),

  // ─── Get my submissions (creator only) ────────────────────────────────────
  getMySubmissions: creatorProcedure.query(async ({ ctx }) => {
    const subs = await ctx.db
      .select({
        submission: submissions,
        campaign: campaigns,
      })
      .from(submissions)
      .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
      .where(eq(submissions.creatorId, ctx.user.id)) // CRITICAL: Creator sees only their own data
      .orderBy(desc(submissions.createdAt));

    // Attach latest metric and earnings to each submission
    const result = await Promise.all(
      subs.map(async ({ submission, campaign }) => {
        const [latestMetric] = await ctx.db
          .select()
          .from(submissionMetrics)
          .where(eq(submissionMetrics.submissionId, submission.id))
          .orderBy(sql`${submissionMetrics.capturedAt} DESC`)
          .limit(1);

        const views = latestMetric?.views ?? 0;
        const estimatedEarning =
          Math.floor(views / 1000) * campaign.payoutPer1kViews;

        return {
          ...submission,
          campaign: { title: campaign.title, payoutPer1kViews: campaign.payoutPer1kViews },
          latestMetric: latestMetric ?? null,
          estimatedEarning,
        };
      })
    );

    return result;
  }),

  // ─── Approve a submission (admin only) ─────────────────────────────────────
  approve: adminProcedure
    .input(approveSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      // approveSubmissionAtomic uses SELECT FOR UPDATE inside a transaction
      return await approveSubmissionAtomic(ctx.db, input.submissionId);
    }),

  // ─── Reject a submission (admin only) ──────────────────────────────────────
  reject: adminProcedure
    .input(rejectSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .select()
        .from(submissions)
        .where(eq(submissions.id, input.submissionId))
        .limit(1);

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Submission not found",
        });
      }
      if (submission.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Submission is already ${submission.status}`,
        });
      }

      const [updated] = await ctx.db
        .update(submissions)
        .set({
          status: "rejected",
          rejectionReason: input.rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(submissions.id, input.submissionId))
        .returning();

      return updated;
    }),

  // ─── Get pending submissions for a campaign (admin only) ──────────────────
  getPendingByCampaign: adminProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const pending = await ctx.db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, input.campaignId),
            eq(submissions.status, "pending")
          )
        )
        .orderBy(desc(submissions.createdAt));

      const withMetrics = await Promise.all(
        pending.map(async (sub) => {
          const [latestMetric] = await ctx.db
            .select()
            .from(submissionMetrics)
            .where(eq(submissionMetrics.submissionId, sub.id))
            .orderBy(sql`${submissionMetrics.capturedAt} DESC`)
            .limit(1);

          return { ...sub, latestMetric: latestMetric ?? null };
        })
      );

      return withMetrics;
    }),
});
