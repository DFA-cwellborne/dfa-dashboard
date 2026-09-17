import { env } from "@/config/env";
import type { SourceAdapter } from "@/lib/types/schema";

// Breakthru's real API only exposes **people** (see breakthruClient.ts) — no
// chapters/groups endpoint exists, so there's nothing here to map into
// Chapter[]/ChapterEvent[]/etc. yet. This adapter currently just reports
// whether credentials are configured, for the admin sync panel; it isn't
// included in the default sync run (see orchestrator.ts) since there's
// nothing for it to write. Once there's a concrete use for Breakthru's
// People data (e.g. cross-checking member counts, or syncing points), add a
// fetch method here using the functions in breakthruClient.ts and wire it
// back into orchestrator.ts's adapter list.
export function createBreakthruAdapter(): SourceAdapter {
  return {
    source: "breakthru",
    isConfigured: () => Boolean(env.breakthru.apiBaseUrl && env.breakthru.apiKey),
  };
}
