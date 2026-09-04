/**
 * Shared formatting utilities used across Admin and Creator UI.
 * Centralised here to satisfy DRY — previously duplicated in 3 page files.
 */

/** Format cents as Euro string, e.g. 25000 → "€250.00" */
export function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/** Format large view counts with K/M suffix, e.g. 54300 → "54.3K" */
export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
