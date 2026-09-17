"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

/**
 * Renders "3 minutes ago"-style text without SSR/hydration mismatches.
 * `formatDistanceToNow` depends on the current instant, so computing it
 * during the server render and again during client hydration can disagree
 * if a minute boundary passes in between — React then throws a hydration
 * error. Rendering a fixed placeholder on first paint (identical on server
 * and client) and swapping in the real value in an effect (a normal
 * post-mount update, not part of hydration reconciliation) avoids that.
 */
export function RelativeTime({ date }: { date: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatDistanceToNow(new Date(date), { addSuffix: true }));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [date]);

  return <>{label ?? "just now"}</>;
}
