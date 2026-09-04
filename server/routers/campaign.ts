import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc/trpc";
import {
  campaigns,
  submissions,
  submissionMetrics,
} from "@/db/schema";
import {
  eq,
  and,
  ilike,
  sql,
  desc,
  count,
} from "drizzle-orm";
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignListFiltersSchema,
} from "@/lib/validations";
import { nanoid } from "nanoid";
import {
  getSubmissionsWithLatestMetrics,
  calculateCampaignStats,
  getDailyViewDeltas,
} from "../services/campaignStats";

export const campaignRouter = router({
  // ─── List campaigns ──────────────────────────────────────────────────────
  list: protectedProcedure
    .input(campaignListFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { search, status, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      // Creators only see active campaigns
      const conditions = [];
      if (ctx.user.role === "creator") {
        conditions.push(eq(campaigns.status, "active"));
      } else if (status) {
        conditions.push(eq(campaigns.status, status));
      }
      if (search) {
        conditions.push(ilike(campaigns.title, `%${search}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totalCount] = await Promise.all([
        ctx.db
          .select()
          .from(campaigns)
          .where(where)
          .orderBy(desc(campaigns.createdAt))
          .limit(pageSize)
          .offset(offset),
        ctx.db
          .select({ count: count() })
          .from(campaigns)
          .where(where),
      ]);

      return {
        campaigns: rows,
        total: totalCount[0]?.count ?? 0,
        page,
        pageSize,
      };
    }),

  // ─── Get campaign by ID with stats (admin only) ───────────────────────────
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);

      if (!campaign) return null;

      const submissions = await getSubmissionsWithLatestMetrics(
        ctx.db,
        input.id,
        campaign.payoutPer1kViews
      );

      const stats = calculateCampaignStats(submissions, campaign.totalBudget);

      const dailyViews = await getDailyViewDeltas(
        ctx.db,
        input.id,
        campaign.startsAt
      );

      return {
        campaign,
        submissions,
        stats,
        dailyViews,
      };
    }),

  // ─── Create campaign (admin only) ────────────────────────────────────────
  create: adminProcedure
    .input(createCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      const id = nanoid();
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values({
          id,
          ...input,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        })
        .returning();
      return campaign;
    }),

  // ─── Update campaign (admin only) ────────────────────────────────────────
  update: adminProcedure
    .input(updateCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [campaign] = await ctx.db
        .update(campaigns)
        .set({
          ...rest,
          startsAt: rest.startsAt ? new Date(rest.startsAt) : undefined,
          endsAt: rest.endsAt ? new Date(rest.endsAt) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, id))
        .returning();
      return campaign;
    }),
});
