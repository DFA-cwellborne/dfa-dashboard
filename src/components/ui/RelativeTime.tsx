"use client";

import { useEffect, useState } from "react";
import { formatCompact } from "@/lib/format/relativeTime";

/**
 * Renders "6m ago"-style text without SSR/hydration mismatches. Computing a
 * relative time depends on the current instant, so doing it during the
 * server render and again during client hydration can disagree if a minute
 * boundary passes in between — React then throws a hydration error.
 * Rendering a fixed placeholder on first paint (identical on server and
 * client) and swapping in the real value in an effect (a normal post-mount
 * update, not part of hydration reconciliation) avoids that.
 */
export function RelativeTime({ date, precise = false }: { date: string; precise?: boolean }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatCompact(new Date(date), Date.now(), precise));
    update();
    const id = setInterval(update, precise ? 1_000 : 15_000);
    return () => clearInterval(id);
  }, [date, precise]);

  return <>{label ?? "just now"}</>;
}
