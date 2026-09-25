import { isSupabaseConfigured } from "@/config/publicEnv";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { PUBLIC_COLUMNS } from "./columns";
import type {
  ChapterEventRow,
  ChapterRow,
  ChapterSignupRow,
  ChapterSnapshotRow,
  SheetSummaryRow,
  SyncLogRow,
} from "@/lib/types/database";

export interface DashboardData {
  configured: boolean;
  chapters: ChapterRow[];
  snapshots: ChapterSnapshotRow[];
  events: ChapterEventRow[];
  signups: ChapterSignupRow[];
  summary: SheetSummaryRow | null;
  latestSync: SyncLogRow | null;
}

const EMPTY: DashboardData = {
  configured: false,
  chapters: [],
  snapshots: [],
  events: [],
  signups: [],
  summary: null,
  latestSync: null,
};

/**
 * Loads everything the dashboard needs in one place. Reads only from
 * Supabase (the synced cache layer) — never hits Google Sheets/Airtable
 * directly. Returns an empty, `configured: false` result if Supabase env
 * vars aren't set yet, so pages can render a setup prompt instead of crashing.
 */
export async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) return EMPTY;

  const supabase = getBrowserSupabase();

  const [chaptersRes, snapshotsRes, eventsRes, signupsRes, summaryRes, syncLogRes] =
    await Promise.all([
      supabase.from("chapters").select(PUBLIC_COLUMNS.chapters).order("name"),
      supabase.from("chapter_snapshots").select(PUBLIC_COLUMNS.chapter_snapshots).order("snapshot_date"),
      supabase.from("chapter_events").select(PUBLIC_COLUMNS.chapter_events),
      supabase.from("chapter_signups").select(PUBLIC_COLUMNS.chapter_signups).order("submitted_at"),
      supabase.from("sheet_summary").select(PUBLIC_COLUMNS.sheet_summary).eq("id", "default").maybeSingle(),
      supabase.from("sync_log").select(PUBLIC_COLUMNS.sync_log).order("created_at", { ascending: false }).limit(1),
    ]);

  // A failed request must not masquerade as "no data" — with the background
  // refresh, one dropped request would otherwise blank the whole dashboard.
  // Throw so the caller can keep showing the last good data instead.
  const failed = [chaptersRes, snapshotsRes, eventsRes, signupsRes, summaryRes, syncLogRes].find(
    (r) => r.error
  );
  if (failed?.error) throw new Error(`Supabase query failed: ${failed.error.message}`);

  return {
    configured: true,
    chapters: chaptersRes.data ?? [],
    snapshots: snapshotsRes.data ?? [],
    events: eventsRes.data ?? [],
    signups: signupsRes.data ?? [],
    summary: summaryRes.data ?? null,
    latestSync: syncLogRes.data?.[0] ?? null,
  };
}

export interface SyncLogSummary {
  bySource: Record<string, SyncLogRow | undefined>;
  recent: SyncLogRow[];
}

export async function getSyncLogSummary(): Promise<SyncLogSummary> {
  if (!isSupabaseConfigured()) return { bySource: {}, recent: [] };
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("sync_log")
    .select(PUBLIC_COLUMNS.sync_log)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const recent = data ?? [];
  const bySource: Record<string, SyncLogRow | undefined> = {};
  for (const row of recent) {
    if (!bySource[row.source]) bySource[row.source] = row;
  }
  return { bySource, recent };
}
