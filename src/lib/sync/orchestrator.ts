import { env } from "@/config/env";
import { getServiceRoleSupabase } from "@/lib/supabase/server";
import type {
  Chapter,
  ChapterEvent,
  ChapterSignup,
  DataSource,
  SheetSummary,
  SourceAdapter,
  SyncResult,
} from "@/lib/types/schema";
import { createAirtableAdapter } from "./airtableAdapter";
import { createGoogleSheetsAdapter } from "./googleSheetsAdapter";
import { createMockAdapter } from "./mockAdapter";
import { redactSecrets } from "./redact";

function mergeChapters(bySource: Map<DataSource, Chapter[]>): Chapter[] {
  // Only Google Sheets (or the mock adapter, standing in for it) provides a
  // chapter roster right now — Airtable/Breakthru don't model chapters at
  // all (see their adapters). This just flattens whatever came back and
  // dedupes by externalId in case that ever changes.
  const merged = new Map<string, Chapter>();
  for (const chapters of bySource.values()) {
    for (const chapter of chapters) merged.set(chapter.externalId, chapter);
  }
  return Array.from(merged.values());
}

interface AdapterRunOutcome {
  source: DataSource;
  result: SyncResult;
  chapters: Chapter[];
  summary: SheetSummary | null;
  signups: ChapterSignup[];
  events: ChapterEvent[];
}

async function runAdapter(adapter: SourceAdapter): Promise<AdapterRunOutcome> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let chapters: Chapter[] = [];
  let summary: SheetSummary | null = null;
  let signups: ChapterSignup[] = [];
  let events: ChapterEvent[] = [];

  function reportError(label: string, e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push(`${label}: ${redactSecrets(message)}`);
  }

  if (adapter.fetchChapters) {
    try {
      chapters = await adapter.fetchChapters();
    } catch (e) {
      reportError("fetchChapters", e);
    }
  }
  if (adapter.fetchSummary) {
    try {
      summary = await adapter.fetchSummary();
    } catch (e) {
      reportError("fetchSummary", e);
    }
  }
  if (adapter.fetchSignups) {
    try {
      signups = await adapter.fetchSignups();
    } catch (e) {
      reportError("fetchSignups", e);
    }
  }
  if (adapter.fetchEvents) {
    try {
      events = await adapter.fetchEvents();
    } catch (e) {
      reportError("fetchEvents", e);
    }
  }

  const finishedAt = new Date().toISOString();
  return {
    source: adapter.source,
    chapters,
    summary,
    signups,
    events,
    result: {
      source: adapter.source,
      success: errors.length === 0,
      startedAt,
      finishedAt,
      recordsProcessed: chapters.length + signups.length + events.length + (summary ? 1 : 0),
      errors,
    },
  };
}

async function logSyncResult(result: SyncResult) {
  try {
    const supabase = getServiceRoleSupabase();
    await supabase.from("sync_log").insert({
      source: result.source,
      success: result.success,
      started_at: result.startedAt,
      finished_at: result.finishedAt,
      records_processed: result.recordsProcessed,
      errors: result.errors,
    });
  } catch (e) {
    console.error("Failed to write sync_log:", redactSecrets(e instanceof Error ? e.message : String(e)));
  }
}

async function persistChapters(chapters: Chapter[]) {
  if (!chapters.length) return;
  const supabase = getServiceRoleSupabase();

  const rows = chapters.map((c) => ({
    external_id: c.externalId,
    name: c.name,
    school_type: c.schoolType,
    status: c.status,
    state: c.state,
    locale: c.locale,
    member_count: c.memberCount,
    signup_date: c.signupDate,
    charter_date: c.charterDate,
    term: c.term,
    source: c.source,
    raw: c.raw,
  }));

  const { error } = await supabase.from("chapters").upsert(rows, { onConflict: "external_id" });
  if (error) throw new Error(`chapters upsert failed: ${error.message}`);

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const snapshotRows = chapters.map((c) => ({
    chapter_external_id: c.externalId,
    snapshot_date: snapshotDate,
    status: c.status,
    member_count: c.memberCount,
    term: c.term,
  }));
  const { error: snapshotError } = await supabase
    .from("chapter_snapshots")
    .upsert(snapshotRows, { onConflict: "chapter_external_id,snapshot_date" });
  if (snapshotError) throw new Error(`chapter_snapshots upsert failed: ${snapshotError.message}`);
}

async function persistSummary(summary: SheetSummary | null) {
  if (!summary) return;
  const supabase = getServiceRoleSupabase();
  const { error } = await supabase.from("sheet_summary").upsert(
    {
      id: "default",
      total_chapters: summary.totalChapters,
      total_members: summary.totalMembers,
      active_chapters: summary.activeChapters,
      status_active: summary.statusCounts.active,
      status_inactive: summary.statusCounts.inactive,
      status_pending_launch: summary.statusCounts.pendingLaunch,
      rso_recognized: summary.rsoCounts.recognized,
      rso_pending: summary.rsoCounts.pending,
      rso_not_recognized: summary.rsoCounts.notRecognized,
      rso_expired: summary.rsoCounts.expired,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`sheet_summary upsert failed: ${error.message}`);
}

async function persistSignups(signups: ChapterSignup[]) {
  if (!signups.length) return;
  const supabase = getServiceRoleSupabase();
  const rows = signups.map((s) => ({
    external_id: s.externalId,
    chapter_name: s.chapterName,
    school_type: s.schoolType,
    submitted_at: s.submittedAt,
    status: s.status,
    source: s.source,
    raw: s.raw,
  }));
  const { error } = await supabase.from("chapter_signups").upsert(rows, { onConflict: "external_id" });
  if (error) throw new Error(`chapter_signups upsert failed: ${error.message}`);
}

async function persistEvents(events: ChapterEvent[]) {
  if (!events.length) return;
  const supabase = getServiceRoleSupabase();
  const rows = events.map((e) => ({
    external_id: e.externalId,
    chapter_external_id: e.chapterExternalId,
    event_type: e.eventType,
    event_date: e.eventDate,
    attendee_count: e.attendeeCount,
    volunteer_hours: e.volunteerHours,
    source: e.source,
    raw: e.raw,
  }));
  const { error } = await supabase.from("chapter_events").upsert(rows, { onConflict: "external_id" });
  if (error) throw new Error(`chapter_events upsert failed: ${error.message}`);
}

function buildAdapters(): SourceAdapter[] {
  if (env.sync.useMockData) {
    return [createMockAdapter()];
  }
  // Breakthru isn't included here — its adapter has nothing to fetch yet
  // (see breakthruAdapter.ts for why). Add it back once that's decided.
  return [createGoogleSheetsAdapter(), createAirtableAdapter()];
}

export interface RunSyncOptions {
  sources?: DataSource[];
}

export async function runSync(options: RunSyncOptions = {}): Promise<SyncResult[]> {
  const adapters = buildAdapters().filter(
    (a) => a.isConfigured() && (!options.sources || options.sources.includes(a.source))
  );

  if (adapters.length === 0) {
    return [
      {
        source: "manual",
        success: false,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        recordsProcessed: 0,
        errors: [
          "No data sources are configured. Set USE_MOCK_DATA=true, or configure Google Sheets/Airtable env vars.",
        ],
      },
    ];
  }

  const outcomes = await Promise.all(adapters.map(runAdapter));

  const bySourceChapters = new Map<DataSource, Chapter[]>();
  let summary: SheetSummary | null = null;
  const allSignups: ChapterSignup[] = [];
  const allEvents: ChapterEvent[] = [];

  for (const outcome of outcomes) {
    bySourceChapters.set(outcome.source, outcome.chapters);
    if (outcome.summary) summary = outcome.summary;
    allSignups.push(...outcome.signups);
    allEvents.push(...outcome.events);
  }

  const mergedChapters = mergeChapters(bySourceChapters);

  let persistError: string | null = null;
  try {
    await persistChapters(mergedChapters);
    await persistSummary(summary);
    await persistSignups(allSignups);
    await persistEvents(allEvents);
  } catch (e) {
    persistError = redactSecrets(e instanceof Error ? e.message : String(e));
  }

  const results = outcomes.map((o) => {
    if (persistError) {
      return { ...o.result, success: false, errors: [...o.result.errors, persistError] };
    }
    return o.result;
  });

  await Promise.all(results.map(logSyncResult));

  return results;
}
