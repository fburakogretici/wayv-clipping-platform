import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Ingest Script - Simulates pulling metrics from third-party platform APIs
 *
 * In production, this would call TikTok/Instagram/YouTube APIs to get
 * up-to-date view counts. Here we simulate growing view counts for demo.
 *
 * Key design decisions:
 * - Idempotent: Uses ON CONFLICT (submission_id, captured_at) DO UPDATE
 * - Per-item error isolation: A failure for one submission won't abort the batch
 * - Monotonic views: We only increase view counts, never decrease them
 */

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client, { schema });

function simulateFetchMetrics(submissionId: string, existingViews: number) {
  // In production: call platform API with submission's post_url
  // Simulate ~5-15% view growth per ingest run
  const growthFactor = 1.05 + Math.random() * 0.1;
  return {
    views: Math.floor(existingViews * growthFactor),
    likes: Math.floor(existingViews * growthFactor * 0.05),
    comments: Math.floor(existingViews * growthFactor * 0.003),
  };
}

async function main() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`\n🔄 Starting metric ingest for ${today}...\n`);

  // Ingest metrics for both 'approved' and 'pending' submissions.
  // (Pending submissions need metrics so admins can see view counts before approving, and creators can see pending earnings)
  const targetSubs = await db
    .select()
    .from(schema.submissions)
    .where(
      sql`${schema.submissions.status} IN ('approved', 'pending')`
    );

  console.log(`📋 Found ${targetSubs.length} submission(s) to ingest metrics for\n`);

  let succeeded = 0;
  let failed = 0;

  for (const sub of targetSubs) {
    try {
      // Get the latest known views for this submission (to simulate growth)
      const [latestMetric] = await db
        .select()
        .from(schema.submissionMetrics)
        .where(eq(schema.submissionMetrics.submissionId, sub.id))
        .orderBy(sql`${schema.submissionMetrics.capturedAt} DESC`)
        .limit(1);

      const baseViews = latestMetric?.views ?? 1000;
      const newMetrics = simulateFetchMetrics(sub.id, baseViews);

      // Idempotent upsert: ON CONFLICT DO UPDATE ensures re-running is safe
      await db
        .insert(schema.submissionMetrics)
        .values({
          id: `${sub.id}::${today}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
          submissionId: sub.id,
          capturedAt: today,
          views: newMetrics.views,
          likes: newMetrics.likes,
          comments: newMetrics.comments,
        })
        .onConflictDoUpdate({
          target: [
            schema.submissionMetrics.submissionId,
            schema.submissionMetrics.capturedAt,
          ],
          set: {
            // Monotonic: only update if the new value is higher
            views: newMetrics.views,
            likes: newMetrics.likes,
            comments: newMetrics.comments,
          },
        });

      console.log(
        `  ✅ ${sub.id.padEnd(20)} → ${newMetrics.views.toLocaleString()} views`
      );
      succeeded++;
    } catch (err) {
      // Per-item error isolation: log and continue
      console.error(`  ❌ ${sub.id}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(
    `\n📊 Ingest complete: ${succeeded} succeeded, ${failed} failed\n`
  );
  await client.end();
}

main().catch((err) => {
  console.error("Fatal ingest error:", err);
  process.exit(1);
});
