/**
 * Shared badge components used across Admin and Creator UI.
 * Centralised here to satisfy DRY — previously duplicated in 3 page files.
 */

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  const icons: Record<string, string> = { tiktok: "🎵", instagram: "📸", youtube: "▶️" };
  return (
    <span className={`platform-badge ${platform}`}>
      {icons[platform]} {platform}
    </span>
  );
}
