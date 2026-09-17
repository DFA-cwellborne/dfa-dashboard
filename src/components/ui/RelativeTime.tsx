"use client";

import { useEffect, useState } from "react";

/** "6m ago", "1hr ago", "1 day ago" — compact, not date-fns's "about 6 minutes ago". */
function formatCompact(date: Date): string {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
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

/**
 * Renders "6m ago"-style text without SSR/hydration mismatches. Computing a
 * relative time depends on the current instant, so doing it during the
 * server render and again during client hydration can disagree if a minute
 * boundary passes in between — React then throws a hydration error.
 * Rendering a fixed placeholder on first paint (identical on server and
 * client) and swapping in the real value in an effect (a normal post-mount
 * update, not part of hydration reconciliation) avoids that.
 */
export function RelativeTime({ date }: { date: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatCompact(new Date(date)));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [date]);

  return <>{label ?? "just now"}</>;
}
