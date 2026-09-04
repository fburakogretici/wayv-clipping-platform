"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCampaignSchema, type CreateCampaignInput } from "@/lib/validations";

function formatCents(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const icons: Record<string, string> = {
    tiktok: "🎵",
    instagram: "📸",
    youtube: "▶️",
  };
  return (
    <span className={`platform-badge ${platform}`}>
      {icons[platform]} {platform}
    </span>
  );
}

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createCampaign = trpc.campaign.create.useMutation({
    onSuccess: () => { onCreated(); onClose(); },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateCampaignInput, unknown, CreateCampaignInput>({
    resolver: zodResolver(createCampaignSchema) as never,
    defaultValues: {
      status: "draft",
      platforms: [],
    },
  });

  const selectedPlatforms = watch("platforms") ?? [];

  function togglePlatform(p: "tiktok" | "instagram" | "youtube") {
    const current = selectedPlatforms as string[];
    if (current.includes(p)) {
      setValue("platforms", current.filter((x) => x !== p) as ("tiktok" | "instagram" | "youtube")[]);
    } else {
      setValue("platforms", [...current, p] as ("tiktok" | "instagram" | "youtube")[]);
    }
  }

  const onSubmit = (data: CreateCampaignInput) => {
    createCampaign.mutate(data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Campaign</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group">
            <label className="form-label">Campaign Title *</label>
            <input
              id="campaign-title"
              className={`form-input ${errors.title ? "error" : ""}`}
              placeholder="e.g. L'Oréal Summer Glow 2026"
              {...register("title")}
            />
            {errors.title && <span className="form-error">{errors.title.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              id="campaign-description"
              className="form-textarea"
              placeholder="Brief for creators..."
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
                id="campaign-payout"
                type="number"
                className={`form-input ${errors.payoutPer1kViews ? "error" : ""}`}
                placeholder="250 = €2.50"
                {...register("payoutPer1kViews", { valueAsNumber: true })}
              />
              {errors.payoutPer1kViews && <span className="form-error">{errors.payoutPer1kViews.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Total Budget (cents) *</label>
              <input
                id="campaign-budget"
                type="number"
                className={`form-input ${errors.totalBudget ? "error" : ""}`}
                placeholder="500000 = €5,000"
                {...register("totalBudget", { valueAsNumber: true })}
              />
              {errors.totalBudget && <span className="form-error">{errors.totalBudget.message}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select id="campaign-status" className="form-select" {...register("status")}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {createCampaign.isError && (
            <div className="alert error">
              ❌ {createCampaign.error?.message ?? "Failed to create campaign"}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              id="create-campaign-submit"
              type="submit"
              className="btn btn-primary"
              disabled={createCampaign.isPending}
            >
              {createCampaign.isPending ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCampaignsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, refetch } = trpc.campaign.list.useQuery({
    search: search || undefined,
    status: (statusFilter as "draft" | "active" | "paused" | "completed") || undefined,
    page,
    pageSize: 20,
  });

  const campaigns = data?.campaigns ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">
            {total} campaign{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          id="create-campaign-btn"
          className="btn btn-primary"
          onClick={() => setShowCreate(true)}
        >
          + New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            id="campaign-search"
            className="form-input search-input"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          id="status-filter"
          className="form-select"
          style={{ width: "auto", minWidth: 140 }}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No campaigns found</div>
          <div className="empty-desc">
            {search ? "Try adjusting your search." : "Create your first campaign to get started."}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Platforms</th>
                <th>Payout / 1k</th>
                <th>Budget</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {c.title}
                    </div>
                    {c.description && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          marginTop: 2,
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      {(c.platforms as string[]).map((p) => (
                        <PlatformBadge key={p} platform={p} />
                      ))}
                    </div>
                  </td>
                  <td style={{ color: "var(--accent-light)", fontWeight: 600 }}>
                    {formatCents(c.payoutPer1kViews)}
                  </td>
                  <td>{formatCents(c.totalBudget)}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span style={{ padding: "0.375rem 0.75rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}
