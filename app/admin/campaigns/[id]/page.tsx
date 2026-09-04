"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  rejectSubmissionSchema,
  type RejectSubmissionInput,
  updateCampaignSchema,
  type UpdateCampaignInput,
} from "@/lib/validations";
import { formatCents, formatViews } from "@/lib/format";
import { StatusBadge, PlatformBadge } from "@/components/Badge";
import { ErrorCodes } from "@/lib/errors";

function DailyViewsChart({ data }: { data: Array<{ capturedAt: string; totalViews: number }> }) {
  if (data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "2rem" }}>
        <div className="empty-icon">📊</div>
        <div className="empty-desc">No metric data yet</div>
      </div>
    );
  }

  const maxViews = Math.max(...data.map((d) => d.totalViews), 1);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Daily Views (Campaign Total)</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Last {data.length} days
        </span>
      </div>
      <div className="chart-area">
        {data.map((d) => {
          const heightPct = (d.totalViews / maxViews) * 100;
          const label = d.capturedAt.slice(5); // MM-DD
          return (
            <div
              key={d.capturedAt}
              className="chart-bar"
              style={{ height: `${Math.max(heightPct, 2)}%` }}
            >
              <div className="chart-bar-tooltip">
                {label}: {formatViews(d.totalViews)} views
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-labels">
        {data.map((d) => (
          <div key={d.capturedAt} className="chart-label">
            {d.capturedAt.slice(5)}
          </div>
        ))}
      </div>
    </div>
  );
}

function RejectModal({
  submissionId,
  onClose,
  onRejected,
}: {
  submissionId: string;
  onClose: () => void;
  onRejected: () => void;
}) {
  const reject = trpc.submission.reject.useMutation({
    onSuccess: () => { onRejected(); onClose(); },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RejectSubmissionInput>({
    resolver: zodResolver(rejectSubmissionSchema),
    defaultValues: { submissionId },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Reject Submission</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit((d) => reject.mutate(d))}>
          <div className="form-group">
            <label className="form-label">Rejection Reason *</label>
            <textarea
              id="rejection-reason"
              className={`form-textarea ${errors.rejectionReason ? "error" : ""}`}
              placeholder="Explain to the creator why their submission was rejected..."
              {...register("rejectionReason")}
            />
            {errors.rejectionReason && (
              <span className="form-error">{errors.rejectionReason.message}</span>
            )}
          </div>
          {reject.isError && (
            <div className="alert error" style={{ marginTop: "0.75rem" }}>
              ❌ {reject.error.message}
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              id="reject-submit-btn"
              type="submit"
              className="btn btn-danger"
              disabled={reject.isPending}
            >
              {reject.isPending ? "Rejecting..." : "Reject Submission"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditCampaignModal({
  campaign,
  onClose,
  onUpdated,
}: {
  campaign: {
    id: string;
    title: string;
    description: string | null;
    platforms: string[];
    payoutPer1kViews: number;
    totalBudget: number;
    status: "draft" | "active" | "paused" | "completed";
  };
  onClose: () => void;
  onUpdated: () => void;
}) {
  const updateCampaign = trpc.campaign.update.useMutation({
    onSuccess: () => {
      onUpdated();
      onClose();
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UpdateCampaignInput, unknown, UpdateCampaignInput>({
    resolver: zodResolver(updateCampaignSchema) as never,
    defaultValues: {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description ?? "",
      platforms: campaign.platforms as ("tiktok" | "instagram" | "youtube")[],
      payoutPer1kViews: campaign.payoutPer1kViews,
      totalBudget: campaign.totalBudget,
      status: campaign.status,
    },
  });

  const selectedPlatforms = watch("platforms") ?? [];

  function togglePlatform(p: "tiktok" | "instagram" | "youtube") {
    const current = (selectedPlatforms as string[]) ?? [];
    if (current.includes(p)) {
      setValue("platforms", current.filter((x) => x !== p) as ("tiktok" | "instagram" | "youtube")[]);
    } else {
      setValue("platforms", [...current, p] as ("tiktok" | "instagram" | "youtube")[]);
    }
  }

  const onSubmit = (data: UpdateCampaignInput) => {
    updateCampaign.mutate(data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Campaign</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input type="hidden" {...register("id")} />

          <div className="form-group">
            <label className="form-label">Campaign Title *</label>
            <input
              id="edit-campaign-title"
              className={`form-input ${errors.title ? "error" : ""}`}
              {...register("title")}
            />
            {errors.title && <span className="form-error">{errors.title.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              id="edit-campaign-description"
              className="form-textarea"
              {...register("description")}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Platforms *</label>
            <div className="checkbox-group">
              {(["tiktok", "instagram", "youtube"] as const).map((p) => (
                <label key={p} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                  />
                  {p === "tiktok" ? "🎵 TikTok" : p === "instagram" ? "📸 Instagram" : "▶️ YouTube"}
                </label>
              ))}
            </div>
            {errors.platforms && <span className="form-error">{errors.platforms.message}</span>}
          </div>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Payout per 1k views (cents) *</label>
              <input
                id="edit-campaign-payout"
                type="number"
                className={`form-input ${errors.payoutPer1kViews ? "error" : ""}`}
                {...register("payoutPer1kViews", { valueAsNumber: true })}
              />
              {errors.payoutPer1kViews && <span className="form-error">{errors.payoutPer1kViews.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Total Budget (cents) *</label>
              <input
                id="edit-campaign-budget"
                type="number"
                className={`form-input ${errors.totalBudget ? "error" : ""}`}
                {...register("totalBudget", { valueAsNumber: true })}
              />
              {errors.totalBudget && <span className="form-error">{errors.totalBudget.message}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select id="edit-campaign-status" className="form-select" {...register("status")}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {updateCampaign.isError && (
            <div className="alert error">
              ❌ {updateCampaign.error?.message ?? "Failed to update campaign"}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              id="edit-campaign-submit"
              type="submit"
              className="btn btn-primary"
              disabled={updateCampaign.isPending}
            >
              {updateCampaign.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<boolean>(false);
  const [tab, setTab] = useState<"all" | "pending">("pending");

  const { data, isLoading, refetch } = trpc.campaign.getById.useQuery({
    id: campaignId,
  });

  const approve = trpc.submission.approve.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <div className="empty-title">Campaign not found</div>
        <Link href="/admin/campaigns" className="btn btn-secondary btn-sm">← Back</Link>
      </div>
    );
  }

  const { campaign, submissions, stats, dailyViews } = data;
  const budgetPct = Math.min((stats.totalSpent / campaign.totalBudget) * 100, 100);
  const filteredSubs = tab === "pending"
    ? submissions.filter((s) => s.status === "pending")
    : submissions;

  return (
    <div>
      <Link href="/admin/campaigns" className="back-link">← All Campaigns</Link>

      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.375rem" }}>
            <h1 className="page-title" style={{ fontSize: "1.375rem" }}>{campaign.title}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="page-subtitle">{campaign.description}</p>
          )}
          <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.5rem" }}>
            {(campaign.platforms as string[]).map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
        </div>
        <button
          id="edit-campaign-btn"
          className="btn btn-secondary btn-sm"
          onClick={() => setEditingCampaign(true)}
        >
          ✏️ Edit Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Budget Spent</div>
          <div className="stat-value" style={{ color: "var(--accent-light)" }}>
            {formatCents(stats.totalSpent)}
          </div>
          <div className="stat-sub">of {formatCents(campaign.totalBudget)} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Budget Remaining</div>
          <div className="stat-value" style={{ color: "#34d399" }}>
            {formatCents(stats.budgetRemaining)}
          </div>
          <div className="stat-sub">{(100 - budgetPct).toFixed(1)}% available</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Views</div>
          <div className="stat-value">{formatViews(stats.totalViews)}</div>
          <div className="stat-sub">across all submissions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: "#fbbf24" }}>
            {stats.pendingCount}
          </div>
          <div className="stat-sub">{stats.approvedCount} approved</div>
        </div>
      </div>

      {/* Budget bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="budget-bar-wrapper">
          <div className="budget-bar-labels">
            <span>Budget utilization</span>
            <span className="spent">{budgetPct.toFixed(1)}% used</span>
          </div>
          <div className="budget-bar-track">
            <div
              className={`budget-bar-fill ${budgetPct > 85 ? "near-limit" : ""}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="budget-bar-labels">
            <span className="spent">{formatCents(stats.totalSpent)} spent</span>
            <span>{formatCents(campaign.totalBudget)} total</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <DailyViewsChart data={dailyViews} />

      {/* Submissions */}
      <div className="card">
        <div className="tabs">
          <button
            className={`tab-btn ${tab === "pending" ? "active" : ""}`}
            onClick={() => setTab("pending")}
          >
            🕐 Pending Review ({stats.pendingCount})
          </button>
          <button
            className={`tab-btn ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            All Submissions ({submissions.length})
          </button>
        </div>

        {filteredSubs.length === 0 ? (
          <div className="empty-state" style={{ padding: "2.5rem" }}>
            <div className="empty-icon">✅</div>
            <div className="empty-title">
              {tab === "pending" ? "No pending submissions" : "No submissions yet"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredSubs.map((sub) => {
              const views = sub.latestMetric?.views ?? 0;
              return (
                <div key={sub.id} className="sub-review-card">
                  <div className="sub-meta-row">
                    <PlatformBadge platform={sub.platform} />
                    <StatusBadge status={sub.status} />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Creator: <strong style={{ color: "var(--text-secondary)" }}>{sub.creatorId}</strong>
                    </span>
                  </div>

                  <a
                    href={sub.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sub-review-url"
                  >
                    🔗 {sub.postUrl}
                  </a>

                  <div className="sub-meta-row">
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      👁 {formatViews(views)} views
                    </span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--accent-light)", fontWeight: 600 }}>
                      Est. earning: {formatCents(sub.earning)}
                    </span>
                  </div>

                  {sub.rejectionReason && (
                    <div className="alert warning" style={{ fontSize: "0.8125rem" }}>
                      Rejection reason: {sub.rejectionReason}
                    </div>
                  )}

                  {sub.status === "pending" && (
                    <div className="sub-review-actions">
                      <button
                        id={`approve-${sub.id}`}
                        className="btn btn-success btn-sm"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate({ submissionId: sub.id })}
                      >
                        ✓ Approve
                      </button>
                      <button
                        id={`reject-${sub.id}`}
                        className="btn btn-danger btn-sm"
                        onClick={() => setRejectingId(sub.id)}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}

                  {approve.isError && approve.variables?.submissionId === sub.id && (
                    <div className="alert error">
                      ❌ {approve.error.message === ErrorCodes.BUDGET_EXCEEDED
                        ? "Cannot approve: this approval would exceed the campaign budget."
                        : approve.error.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectingId && (
        <RejectModal
          submissionId={rejectingId}
          onClose={() => setRejectingId(null)}
          onRejected={() => refetch()}
        />
      )}

      {editingCampaign && (
        <EditCampaignModal
          campaign={campaign}
          onClose={() => setEditingCampaign(false)}
          onUpdated={() => refetch()}
        />
      )}
    </div>
  );
}
