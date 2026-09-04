"use client";

import { trpc } from "@/lib/trpc";

import { formatCents, formatViews } from "@/lib/format";
import { StatusBadge, PlatformBadge } from "@/components/Badge";

export default function CreatorSubmissionsPage() {
  const { data, isLoading } = trpc.submission.getMySubmissions.useQuery();
  const submissions = data ?? [];

  const totalViews = submissions.reduce(
    (sum, s) => sum + (s.latestMetric?.views ?? 0),
    0
  );
  const totalEarnings = submissions
    .filter((s) => s.status === "approved" || s.status === "paid")
    .reduce((sum, s) => sum + s.estimatedEarning, 0);
  const pendingEarnings = submissions
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.estimatedEarning, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Submissions</h1>
          <p className="page-subtitle">
            Track your clip performance and earnings
          </p>
        </div>
      </div>

      {/* Stats */}
      {submissions.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card">
            <div className="stat-label">Total Submissions</div>
            <div className="stat-value">{submissions.length}</div>
            <div className="stat-sub">
              {submissions.filter((s) => s.status === "approved").length} approved
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Views</div>
            <div className="stat-value">{formatViews(totalViews)}</div>
            <div className="stat-sub">across all clips</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Confirmed Earnings</div>
            <div className="stat-value" style={{ color: "#34d399" }}>
              {formatCents(totalEarnings)}
            </div>
            <div className="stat-sub">from approved submissions</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Earnings</div>
            <div className="stat-value" style={{ color: "#fbbf24" }}>
              {formatCents(pendingEarnings)}
            </div>
            <div className="stat-sub">awaiting approval</div>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📤</div>
          <div className="empty-title">No submissions yet</div>
          <div className="empty-desc">
            Browse active campaigns and submit your first clip to start earning.
          </div>
          <a href="/creator/campaigns" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
            Browse Campaigns →
          </a>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Platform</th>
                <th>Views</th>
                <th>Est. Earnings</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Post</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const views = s.latestMetric?.views ?? 0;
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {s.campaign.title}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {formatCents(s.campaign.payoutPer1kViews)} / 1k views
                      </div>
                    </td>
                    <td>
                      <PlatformBadge platform={s.platform} />
                    </td>
                    <td>
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                        {formatViews(views)}
                      </span>
                      {s.latestMetric && (
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {s.latestMetric.likes} ❤️  {s.latestMetric.comments} 💬
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            s.status === "approved" || s.status === "paid"
                              ? "#34d399"
                              : s.status === "rejected"
                              ? "var(--text-muted)"
                              : "#fbbf24",
                        }}
                      >
                        {formatCents(s.estimatedEarning)}
                      </span>
                    </td>
                    <td>
                      <div>
                        <StatusBadge status={s.status} />
                        {s.status === "rejected" && s.rejectionReason && (
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-muted)",
                              marginTop: 4,
                              maxWidth: 200,
                            }}
                            title={s.rejectionReason}
                          >
                            {s.rejectionReason.slice(0, 60)}
                            {s.rejectionReason.length > 60 ? "..." : ""}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <a
                        href={s.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        title={s.postUrl}
                      >
                        🔗 View
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
