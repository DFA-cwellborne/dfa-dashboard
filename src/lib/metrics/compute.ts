import type {
  ChapterEventRow,
  ChapterRow,
  ChapterSignupRow,
  ChapterSnapshotRow,
  SheetSummaryRow,
} from "@/lib/types/database";

// ---------------------------------------------------------------------------
// All aggregation helpers here treat missing data as "excluded", never as
// zero — a chapter that hasn't reported member_count doesn't drag the
// average down, it's just not counted in the denominator.
// ---------------------------------------------------------------------------

function avgExcludingNulls(values: (number | null | undefined)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (!present.length) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

function sumExcludingNulls(values: (number | null | undefined)[]): number {
  return values.reduce((a: number, b) => a + (b ?? 0), 0);
}

export interface ChapterCounts {
  total: number;
  active: number;
  hs: number;
  college: number;
  activeHs: number;
  activeCollege: number;
  noSchoolTypeReported: number;
}

/**
 * Prefers the Google Sheets "Home" tab's own aggregate totals (in
 * `summary`) when available — the sheet's roster only has name+members per
 * row, so per-chapter status isn't derivable; the sheet's pre-computed
 * counts are the more accurate source. Falls back to counting the roster
 * once real per-chapter status exists.
 */
export function computeChapterCounts(
  chapters: ChapterRow[],
  summary?: SheetSummaryRow | null
): ChapterCounts {
  const active = chapters.filter((c) => c.status === "active");
  return {
    total: summary?.total_chapters ?? chapters.length,
    active: summary?.active_chapters ?? active.length,
    hs: chapters.filter((c) => c.school_type === "HS").length,
    college: chapters.filter((c) => c.school_type === "College").length,
    activeHs: active.filter((c) => c.school_type === "HS").length,
    activeCollege: active.filter((c) => c.school_type === "College").length,
    noSchoolTypeReported: chapters.filter((c) => !c.school_type).length,
  };
}

export interface StatusBreakdown {
  active: number | null;
  inactive: number | null;
  pendingLaunch: number | null;
}

export function computeStatusBreakdown(
  chapters: ChapterRow[],
  summary?: SheetSummaryRow | null
): StatusBreakdown {
  if (summary) {
    return {
      active: summary.status_active,
      inactive: summary.status_inactive,
      pendingLaunch: summary.status_pending_launch,
    };
  }
  return {
    active: chapters.filter((c) => c.status === "active").length,
    inactive: chapters.filter((c) => c.status === "inactive").length,
    pendingLaunch: chapters.filter((c) => c.status === "pending_launch").length,
  };
}

export interface RsoBreakdown {
  recognized: number | null;
  pending: number | null;
  notRecognized: number | null;
  expired: number | null;
}

/** RSO status only exists as a sheet-level aggregate, not per chapter. */
export function computeRsoBreakdown(summary?: SheetSummaryRow | null): RsoBreakdown {
  return {
    recognized: summary?.rso_recognized ?? null,
    pending: summary?.rso_pending ?? null,
    notRecognized: summary?.rso_not_recognized ?? null,
    expired: summary?.rso_expired ?? null,
  };
}

export interface MembershipStats {
  totalMembers: number;
  avgPerChapter: number | null;
  avgPerChapterHs: number | null;
  avgPerChapterCollege: number | null;
  chaptersReporting: number;
  chaptersMissingData: number;
}

export function computeMembershipStats(
  chapters: ChapterRow[],
  summary?: SheetSummaryRow | null
): MembershipStats {
  const active = chapters.filter((c) => c.status === "active");
  return {
    totalMembers: summary?.total_members ?? sumExcludingNulls(active.map((c) => c.member_count)),
    avgPerChapter: avgExcludingNulls(active.map((c) => c.member_count)),
    avgPerChapterHs: avgExcludingNulls(
      active.filter((c) => c.school_type === "HS").map((c) => c.member_count)
    ),
    avgPerChapterCollege: avgExcludingNulls(
      active.filter((c) => c.school_type === "College").map((c) => c.member_count)
    ),
    chaptersReporting: active.filter((c) => c.member_count !== null).length,
    chaptersMissingData: active.filter((c) => c.member_count === null).length,
  };
}

export interface EventBreakdown {
  /** Every event logged, past or planned. */
  total: number;
  /** Planned date is today or earlier. */
  held: number;
  /** Planned date is still ahead. */
  upcoming: number;
  /** Logged without a usable date. */
  undated: number;
  /** By the form's own type labels, most common first. */
  byType: { type: string; label: string; count: number }[];
}

/**
 * The events form is a *planning* form: an event is logged when a chapter
 * files it, before it happens. So "logged" and "held" differ — `today` (a
 * YYYY-MM-DD in the viewer's timezone) splits them. Types are whatever the
 * form's dropdown says, not a list baked in here.
 */
export function computeEventBreakdown(events: ChapterEventRow[], today: string): EventBreakdown {
  const counts = new Map<string, number>();
  let held = 0;
  let upcoming = 0;
  let undated = 0;

  for (const e of events) {
    const key = e.event_type?.trim() || "Unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!e.event_date) undated++;
    else if (e.event_date > today) upcoming++;
    else held++;
  }

  const byType = Array.from(counts, ([type, count]) => ({ type, label: type, count })).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
  return { total: events.length, held, upcoming, undated, byType };
}

export interface RetentionStats {
  currentTerm: string | null;
  previousTerm: string | null;
  activeCurrentTerm: number;
  activeChaptersRetained: number;
  retentionRate: number | null;
}

/** Retention = chapters active last term that are still active this term. */
export function computeRetention(snapshots: ChapterSnapshotRow[]): RetentionStats {
  const terms = Array.from(new Set(snapshots.map((s) => s.term).filter(Boolean))) as string[];
  // Assumes terms sort lexically in chronological order (e.g. "2026-Fall");
  // adjust if the sheet uses a different term naming convention.
  terms.sort();
  const currentTerm = terms.at(-1) ?? null;
  const previousTerm = terms.length > 1 ? terms.at(-2)! : null;

  if (!currentTerm || !previousTerm) {
    return {
      currentTerm,
      previousTerm,
      activeCurrentTerm: 0,
      activeChaptersRetained: 0,
      retentionRate: null,
    };
  }

  const activePrev = new Set(
    snapshots.filter((s) => s.term === previousTerm && s.status === "active").map((s) => s.chapter_external_id)
  );
  const activeCurrentSet = new Set(
    snapshots.filter((s) => s.term === currentTerm && s.status === "active").map((s) => s.chapter_external_id)
  );
  const retained = Array.from(activePrev).filter((id) => activeCurrentSet.has(id));

  return {
    currentTerm,
    previousTerm,
    activeCurrentTerm: activeCurrentSet.size,
    activeChaptersRetained: retained.length,
    retentionRate: activePrev.size > 0 ? retained.length / activePrev.size : null,
  };
}

export interface TimeToCharterStats {
  avgDays: number | null;
  chaptersReporting: number;
}

export function computeTimeToCharter(chapters: ChapterRow[]): TimeToCharterStats {
  const withBothDates = chapters.filter((c) => c.signup_date && c.charter_date);
  const days = withBothDates.map((c) => {
    const signup = new Date(c.signup_date!).getTime();
    const charter = new Date(c.charter_date!).getTime();
    return (charter - signup) / (1000 * 60 * 60 * 24);
  });
  return { avgDays: avgExcludingNulls(days), chaptersReporting: withBothDates.length };
}

export interface TrendPoint {
  date: string;
  chapters: number;
  members: number;
}

/**
 * Builds a members/chapters-over-time series from daily chapter_snapshots.
 * Counts every roster row, not just status === "active" — the Sheets roster
 * doesn't carry per-chapter status (only the sheet's own aggregate does, via
 * SheetSummary), so filtering by status here would zero out the whole trend.
 */
export function computeTrendSeries(snapshots: ChapterSnapshotRow[]): TrendPoint[] {
  const byDate = new Map<string, ChapterSnapshotRow[]>();
  for (const s of snapshots) {
    if (!byDate.has(s.snapshot_date)) byDate.set(s.snapshot_date, []);
    byDate.get(s.snapshot_date)!.push(s);
  }
  return Array.from(byDate.entries())
    .map(([date, rows]) => ({
      date,
      chapters: rows.length,
      members: sumExcludingNulls(rows.map((r) => r.member_count)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SignupTrendPoint {
  date: string;
  count: number;
  cumulative: number;
}

/** Signups submitted in the last `days` days. */
export function countRecentSignups(signups: ChapterSignupRow[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return signups.filter((s) => s.submitted_at && new Date(s.submitted_at).getTime() >= cutoff).length;
}

/** Daily + running-total "start a chapter" signup counts, for the date-range chart. */
export function computeSignupsTrend(signups: ChapterSignupRow[]): SignupTrendPoint[] {
  const byDate = new Map<string, number>();
  for (const s of signups) {
    if (!s.submitted_at) continue;
    byDate.set(s.submitted_at, (byDate.get(s.submitted_at) ?? 0) + 1);
  }
  const sorted = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  return sorted.map(([date, count]) => {
    cumulative += count;
    return { date, count, cumulative };
  });
}
