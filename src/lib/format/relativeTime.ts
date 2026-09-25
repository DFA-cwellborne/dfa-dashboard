/**
 * "6m ago", "1hr ago", "1 day ago" — compact, not date-fns's "about 6 minutes ago".
 * With `precise`, anything under a minute is shown in seconds ("12s ago") so a
 * fresh check is visibly distinguishable from one a moment ago.
 */
export function formatCompact(date: Date, now: number = Date.now(), precise = false): string {
  const diffSec = Math.round((now - date.getTime()) / 1000);
  if (precise && diffSec < 60) return diffSec < 3 ? "just now" : `${diffSec}s ago`;
  if (diffSec < 45) return "just now";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}hr ago`;

  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;

  const diffYear = Math.round(diffMonth / 12);
  return `${diffYear}yr ago`;
}
