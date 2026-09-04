import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // ─── Users ─────────────────────────────────────────────────────────────────
  await db
    .insert(schema.users)
    .values([
      {
        id: "admin-1",
        email: "admin@wayv.com",
        name: "Sarah Admin",
        role: "admin",
      },
      {
        id: "admin-2",
        email: "admin2@wayv.com",
        name: "Tom Admin",
        role: "admin",
      },
      {
        id: "creator-1",
        email: "alice@creator.com",
        name: "Alice Creator",
        role: "creator",
      },
      {
        id: "creator-2",
        email: "bob@creator.com",
        name: "Bob Creator",
        role: "creator",
      },
      {
        id: "creator-3",
        email: "charlie@creator.com",
        name: "Charlie Creator",
        role: "creator",
      },
    ])
    .onConflictDoNothing();

  // ─── Campaigns ─────────────────────────────────────────────────────────────
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db
    .insert(schema.campaigns)
    .values([
      {
        id: "campaign-1",
        title: "L'Oréal Summer Glow 2026",
        description:
          "Promote L'Oréal summer collection with creative short-form videos showcasing the glow effect.",
        platforms: ["tiktok", "instagram"],
        payoutPer1kViews: 250, // €2.50 per 1k views
        totalBudget: 500000, // €5,000 total
        status: "active",
        startsAt: now,
        endsAt: in30Days,
      },
      {
        id: "campaign-2",
        title: "Sony Music - Viral Beat Challenge",
        description:
          "Create clips using Sony's new artist tracks and participate in the beat challenge.",
        platforms: ["tiktok"],
        payoutPer1kViews: 300, // €3.00 per 1k views
        totalBudget: 300000, // €3,000 total
        status: "active",
        startsAt: now,
        endsAt: in30Days,
      },
      {
        id: "campaign-3",
        title: "Samsung Galaxy Review Campaign",
        description:
          "Short-form reviews and unboxings of the Samsung Galaxy Z Fold line.",
        platforms: ["tiktok", "instagram", "youtube"],
        payoutPer1kViews: 200,
        totalBudget: 750000, // €7,500 total
        status: "active",
        startsAt: now,
        endsAt: in30Days,
      },
      {
        id: "campaign-4",
        title: "Warner Music - Summer Playlist",
        description: "Promote Warner Music summer hits with creative clips.",
        platforms: ["instagram", "youtube"],
        payoutPer1kViews: 150,
        totalBudget: 200000, // €2,000 total
        status: "paused",
        startsAt: now,
        endsAt: in30Days,
      },
      {
        id: "campaign-5",
        title: "YouTube Shorts Creator Program",
        description: "Exclusive YouTube Shorts campaign for selected creators.",
        platforms: ["youtube"],
        payoutPer1kViews: 400,
        totalBudget: 1000000, // €10,000 total
        status: "draft",
        startsAt: in30Days,
        endsAt: new Date(in30Days.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  // ─── Submissions ───────────────────────────────────────────────────────────
  await db
    .insert(schema.submissions)
    .values([
      {
        id: "sub-1",
        campaignId: "campaign-1",
        creatorId: "creator-1",
        postUrl: "https://www.tiktok.com/@alice/video/123456",
        platform: "tiktok",
        status: "approved",
      },
      {
        id: "sub-2",
        campaignId: "campaign-1",
        creatorId: "creator-2",
        postUrl: "https://www.instagram.com/p/bob_loreal",
        platform: "instagram",
        status: "pending",
      },
      {
        id: "sub-3",
        campaignId: "campaign-2",
        creatorId: "creator-1",
        postUrl: "https://www.tiktok.com/@alice/video/654321",
        platform: "tiktok",
        status: "approved",
      },
      {
        id: "sub-4",
        campaignId: "campaign-2",
        creatorId: "creator-3",
        postUrl: "https://www.tiktok.com/@charlie/video/111222",
        platform: "tiktok",
        status: "rejected",
        rejectionReason:
          "Post does not use the required audio track from the brief.",
      },
      {
        id: "sub-5",
        campaignId: "campaign-3",
        creatorId: "creator-2",
        postUrl: "https://www.youtube.com/shorts/bob_samsung",
        platform: "youtube",
        status: "pending",
      },
      {
        id: "sub-6",
        campaignId: "campaign-1",
        creatorId: "creator-3",
        postUrl: "https://www.tiktok.com/@charlie/video/333444",
        platform: "tiktok",
        status: "pending",
      },
    ])
    .onConflictDoNothing();

  // ─── Submission Metrics (last 7 days of data for approved) ─────────────────
  const today = new Date().toISOString().split("T")[0];
  const metricsToInsert = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    metricsToInsert.push({
      id: `metric-sub1-d${i}`,
      submissionId: "sub-1",
      capturedAt: dateStr,
      views: 15000 + (6 - i) * 4200,
      likes: 800 + (6 - i) * 180,
      comments: 50 + (6 - i) * 12,
    });

    metricsToInsert.push({
      id: `metric-sub3-d${i}`,
      submissionId: "sub-3",
      capturedAt: dateStr,
      views: 22000 + (6 - i) * 6500,
      likes: 1200 + (6 - i) * 320,
      comments: 90 + (6 - i) * 25,
    });
  }

  // Add today's metrics for pending submissions (for display purposes)
  metricsToInsert.push({
    id: `metric-sub2-d0`,
    submissionId: "sub-2",
    capturedAt: today,
    views: 8300,
    likes: 420,
    comments: 28,
  });
  metricsToInsert.push({
    id: `metric-sub5-d0`,
    submissionId: "sub-5",
    capturedAt: today,
    views: 31000,
    likes: 1800,
    comments: 145,
  });
  metricsToInsert.push({
    id: `metric-sub6-d0`,
    submissionId: "sub-6",
    capturedAt: today,
    views: 5500,
    likes: 290,
    comments: 18,
  });

  await db
    .insert(schema.submissionMetrics)
    .values(metricsToInsert)
    .onConflictDoNothing();

  console.log("✅ Seeding complete!");
  console.log("\n📋 Dev user credentials:");
  console.log("  Admin:   admin@wayv.com   (id: admin-1)");
  console.log("  Admin 2: admin2@wayv.com  (id: admin-2)");
  console.log("  Creator: alice@creator.com (id: creator-1)");
  console.log("  Creator: bob@creator.com   (id: creator-2)");
  console.log("  Creator: charlie@creator.com (id: creator-3)");

  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
