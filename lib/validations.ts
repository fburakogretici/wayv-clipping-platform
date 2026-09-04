import { z } from "zod";

// ─── Campaign Schemas ──────────────────────────────────────────────────────────

export const platformSchema = z.enum(["tiktok", "instagram", "youtube"]);

export const campaignStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
]);

export const createCampaignSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
  platforms: z
    .array(platformSchema)
    .min(1, "Select at least one platform"),
  payoutPer1kViews: z
    .number()
    .int()
    .min(1, "Payout must be at least 1 cent")
    .max(100000, "Payout seems too high"),
  totalBudget: z
    .number()
    .int()
    .min(100, "Budget must be at least €1")
    .max(100_000_000, "Budget exceeds maximum"),
  status: campaignStatusSchema.default("draft"),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  id: z.string(),
});

export const campaignListFiltersSchema = z.object({
  search: z.string().optional(),
  status: campaignStatusSchema.optional(),
  platform: platformSchema.optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// ─── Submission Schemas ────────────────────────────────────────────────────────

// Real post URL regex patterns for TikTok, Instagram, and YouTube
const TIKTOK_URL_REGEX = /^https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/(@[\w.-]+\/video\/\d+|[\w.-]+)/i;
const INSTAGRAM_URL_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[\w.-]+/i;
const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/(shorts\/|watch\?v=)|youtu\.be\/)[\w.-]+/i;

export const submitClipSchema = z
  .object({
    campaignId: z.string().min(1, "Campaign ID is required"),
    postUrl: z.string().url("Must be a valid URL"),
    platform: platformSchema,
  })
  .superRefine((data, ctx) => {
    if (data.platform === "tiktok" && !TIKTOK_URL_REGEX.test(data.postUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postUrl"],
        message: "Must be a valid TikTok post URL (e.g. https://www.tiktok.com/@creator/video/1234567890)",
      });
    } else if (data.platform === "instagram" && !INSTAGRAM_URL_REGEX.test(data.postUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postUrl"],
        message: "Must be a valid Instagram Reel/Post URL (e.g. https://www.instagram.com/p/abc123/ or /reel/abc123/)",
      });
    } else if (data.platform === "youtube" && !YOUTUBE_URL_REGEX.test(data.postUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postUrl"],
        message: "Must be a valid YouTube Shorts or Video URL (e.g. https://www.youtube.com/shorts/abc123)",
      });
    }
  });

export const rejectSubmissionSchema = z.object({
  submissionId: z.string(),
  rejectionReason: z
    .string()
    .min(10, "Please provide a detailed rejection reason")
    .max(500),
});

export const approveSubmissionSchema = z.object({
  submissionId: z.string(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CampaignListFilters = z.infer<typeof campaignListFiltersSchema>;
export type SubmitClipInput = z.infer<typeof submitClipSchema>;
export type RejectSubmissionInput = z.infer<typeof rejectSubmissionSchema>;
export type ApproveSubmissionInput = z.infer<typeof approveSubmissionSchema>;
