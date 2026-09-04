"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitClipSchema, type SubmitClipInput } from "@/lib/validations";

import { formatCents } from "@/lib/format";
import { PlatformBadge } from "@/components/Badge";

function SubmitClipModal({
  campaign,
  onClose,
  onSubmitted,
}: {
  campaign: { id: string; title: string; platforms: string[] };
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const submit = trpc.submission.submitClip.useMutation({
    onSuccess: () => { onSubmitted(); onClose(); },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmitClipInput>({
    resolver: zodResolver(submitClipSchema),
    defaultValues: {
      campaignId: campaign.id,
      platform: campaign.platforms[0] as "tiktok" | "instagram" | "youtube",
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Submit Clip</h2>
            <p className="card-subtitle">{campaign.title}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit((d) => submit.mutate(d))}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input type="hidden" {...register("campaignId")} />

            <div className="form-group">
              <label className="form-label">Platform *</label>
              <select
                id="submit-platform"
                className={`form-select ${errors.platform ? "error" : ""}`}
                {...register("platform")}
              >
                {campaign.platforms.map((p) => (
                  <option key={p} value={p}>
                    {p === "tiktok" ? "🎵 TikTok" : p === "instagram" ? "📸 Instagram" : "▶️ YouTube"}
                  </option>
                ))}
              </select>
              {errors.platform && <span className="form-error">{errors.platform.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Post URL *</label>
              <input
                id="submit-url"
                type="url"
                className={`form-input ${errors.postUrl ? "error" : ""}`}
                placeholder="https://www.tiktok.com/@you/video/..."
                {...register("postUrl")}
              />
              {errors.postUrl && <span className="form-error">{errors.postUrl.message}</span>}
            </div>

            {submit.isError && (
              <div className="alert error">
                ❌ {submit.error.message}
              </div>
            )}
            {submit.isSuccess && (
              <div className="alert success">
                ✅ Submission received! It will be reviewed by the campaign admin.
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              id="submit-clip-btn"
              type="submit"
              className="btn btn-primary"
              disabled={submit.isPending}
            >
              {submit.isPending ? "Submitting..." : "Submit Clip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreatorCampaignsPage() {
  const [submittingCampaign, setSubmittingCampaign] = useState<{
    id: string; title: string; platforms: string[];
  } | null>(null);

  const { data, isLoading, refetch } = trpc.campaign.list.useQuery({
    page: 1,
    pageSize: 50,
  });

  const campaigns = data?.campaigns ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Browse Campaigns</h1>
          <p className="page-subtitle">
            {campaigns.length} active campaign{campaigns.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="campaigns-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div className="empty-title">No active campaigns</div>
          <div className="empty-desc">
            Check back soon — new campaigns are added regularly.
          </div>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((c) => (
            <div key={c.id} className="campaign-card">
              <div className="campaign-card-header">
                <div className="campaign-card-title">{c.title}</div>
                <span className="badge active">
                  <span className="badge-dot" />
                  active
                </span>
              </div>

              {c.description && (
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {c.description}
                </p>
              )}

              <div className="campaign-card-meta">
                {(c.platforms as string[]).map((p) => (
                  <PlatformBadge key={p} platform={p} />
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div className="campaign-payout">
                  Earn <strong>{formatCents(c.payoutPer1kViews)}</strong> per 1k views
                </div>
                <button
                  id={`submit-${c.id}`}
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setSubmittingCampaign({
                      id: c.id,
                      title: c.title,
                      platforms: c.platforms as string[],
                    });
                  }}
                >
                  Submit Clip →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {submittingCampaign && (
        <SubmitClipModal
          campaign={submittingCampaign}
          onClose={() => setSubmittingCampaign(null)}
          onSubmitted={() => refetch()}
        />
      )}
    </div>
  );
}
