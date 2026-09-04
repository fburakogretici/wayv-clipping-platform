import { sql, eq, and, desc } from "drizzle-orm";
import { Database } from "@/db";
import { submissions, submissionMetrics } from "@/db/schema";
import { CHART_MAX_DAYS, MS_PER_DAY } from "@/lib/constants";

export async function getSubmissionsWithLatestMetrics(
  db: Database,
  campaignId: string,
  payoutPer1kViews: number
) {
  // 1. Get all submissions
  const subs = await db
    .select()
    .from(submissions)
    .where(eq(submissions.campaignId, campaignId))
    .orderBy(desc(submissions.createdAt));

  if (subs.length === 0) return [];

  const subIds = subs.map((s) => s.id);

  // 2. N+1 FIX: Get latest metric for ALL submissions in ONE query
  // PostgreSQL DISTINCT ON is perfect for getting the "latest" per group
  const rawLatestMetrics = await db.execute(sql`
    SELECT DISTINCT ON (submission_id)
      submission_id, views, likes, comments, captured_at
    FROM submission_metrics
    WHERE submission_id IN (${sql.join(subIds, sql`, `)})
    ORDER BY submission_id, captured_at DESC
  `);

  const metricMap = new Map();
  for (const row of rawLatestMetrics) {
    metricMap.set(row.submission_id, {
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      capturedAt: row.captured_at,
    });
  }

  // 3. Combine and calculate earnings
  return subs.map((sub) => {
    const latestMetric = metricMap.get(sub.id) ?? null;
    const views = latestMetric?.views ?? 0;
    const earning = Math.floor(views / 1000) * payoutPer1kViews;
    
    return { ...sub, latestMetric, earning };
  });
}

export function calculateCampaignStats(
  subsWithMetrics: any[],
  totalBudget: number
) {
  const approvedSubs = subsWithMetrics.filter((s) => s.status === "approved");
  
  const totalSpent = approvedSubs.reduce((sum, s) => sum + s.earning, 0);
  const totalViews = approvedSubs.reduce(
    (sum, sub) => sum + (sub.latestMetric?.views ?? 0),
    0
  );

  return {
    totalSpent,
    budgetRemaining: Math.max(totalBudget - totalSpent, 0),
    totalViews,
    pendingCount: subsWithMetrics.filter((s) => s.status === "pending").length,
    approvedCount: approvedSubs.length,
  };
}

export async function getDailyViewDeltas(
  db: Database,
  campaignId: string,
  startsAt: Date | null
) {
  // Get raw metric records for this campaign
  const rawMetrics = await db
    .select({
      capturedAt: submissionMetrics.capturedAt,
      totalViews: sql<number>`COALESCE(sum(${submissionMetrics.views}), 0)`.as(
        "total_views"
      ),
    })
    .from(submissionMetrics)
    .innerJoin(
      submissions,
      eq(submissionMetrics.submissionId, submissions.id)
    )
    .where(
      and(
        eq(submissions.campaignId, campaignId),
        eq(submissions.status, "approved")
      )
    )
    .groupBy(submissionMetrics.capturedAt);

  const metricMap = new Map<string, number>();
  for (const row of rawMetrics) {
    metricMap.set(row.capturedAt, Number(row.totalViews) || 0);
  }

  // Generate date range
  const now = new Date();
  const startDate = startsAt
    ? new Date(Math.max(startsAt.getTime(), now.getTime() - CHART_MAX_DAYS * MS_PER_DAY))
    : new Date(now.getTime() - CHART_MAX_DAYS * MS_PER_DAY);
  
  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const paddedDailyViews: Array<{ capturedAt: string; totalViews: number }> = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (current <= today) {
    const dateKey = formatDateKey(current);
    paddedDailyViews.push({
      capturedAt: dateKey,
      totalViews: metricMap.get(dateKey) ?? 0,
    });
    current.setDate(current.getDate() + 1);
  }

  // Deltas
  return paddedDailyViews.map((d, i) => ({
    capturedAt: d.capturedAt,
    totalViews: i === 0
      ? d.totalViews
      : Math.max(d.totalViews - paddedDailyViews[i - 1].totalViews, 0),
  }));
}
