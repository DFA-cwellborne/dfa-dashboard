import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ChapterEventRow,
  ChapterRow,
  ChapterSignupRow,
  ChapterSnapshotRow,
  SheetSummaryRow,
} from "@/lib/types/database";
import {
  computeChapterCounts,
  computeEventBreakdown,
  computeMembershipStats,
  computeRetention,
  computeRsoBreakdown,
  computeSignupsTrend,
  computeStatusBreakdown,
  computeTimeToCharter,
  computeTrendSeries,
  countRecentSignups,
} from "./compute";

const chapter = (o: Partial<ChapterRow> = {}): ChapterRow => ({
  id: "1", external_id: "c1", name: "C1", school_type: "College", status: "active", state: "TX",
  locale: null, member_count: 10, signup_date: null, charter_date: null, term: null,
  source: "google_sheets", created_at: "", updated_at: "", ...o,
});

const summary = (o: Partial<SheetSummaryRow> = {}): SheetSummaryRow => ({
  id: "default", total_chapters: 6, total_members: 1400, active_chapters: 4,
  status_active: 4, status_inactive: 0, status_pending_launch: 2,
  rso_recognized: 5, rso_pending: 7, rso_not_recognized: 0, rso_expired: 0, synced_at: "", ...o,
});

const snapshot = (o: Partial<ChapterSnapshotRow>): ChapterSnapshotRow => ({
  id: "s", chapter_external_id: "c1", snapshot_date: "2026-09-01", status: "active", member_count: 1, term: null, created_at: "", ...o,
});

const signup = (submitted_at: string | null): ChapterSignupRow => ({
  id: submitted_at ?? "x", external_id: submitted_at ?? "x", chapter_name: null, school_type: null,
  submitted_at, status: null, source: "airtable", created_at: "",
});

afterEach(() => vi.useRealTimers());

describe("computeChapterCounts", () => {
  it("prefers the sheet's own aggregate totals over counting the roster", () => {
    const c = computeChapterCounts([chapter()], summary());
    expect(c.total).toBe(6);
    expect(c.active).toBe(4);
  });

  it("falls back to counting the roster when there's no summary", () => {
    const c = computeChapterCounts([chapter(), chapter({ external_id: "c2", status: "inactive" })], null);
    expect(c.total).toBe(2);
    expect(c.active).toBe(1);
  });

  it("splits HS/College and tracks chapters with no type", () => {
    const c = computeChapterCounts(
      [chapter({ school_type: "HS" }), chapter({ school_type: "College" }), chapter({ school_type: null })],
      null
    );
    expect([c.hs, c.college, c.noSchoolTypeReported]).toEqual([1, 1, 1]);
  });
});

describe("computeMembershipStats", () => {
  it("excludes unreported chapters from the average instead of counting them as zero", () => {
    const m = computeMembershipStats(
      [chapter({ member_count: 10 }), chapter({ member_count: 20 }), chapter({ member_count: null })],
      null
    );
    expect(m.avgPerChapter).toBe(15); // not 10
    expect(m.chaptersReporting).toBe(2);
    expect(m.chaptersMissingData).toBe(1);
  });

  it("counts a real zero as reported", () => {
    const m = computeMembershipStats([chapter({ member_count: 0 }), chapter({ member_count: 10 })], null);
    expect(m.avgPerChapter).toBe(5);
  });

  it("returns a null average (not 0 or NaN) when nothing has reported", () => {
    expect(computeMembershipStats([chapter({ member_count: null })], null).avgPerChapter).toBeNull();
    expect(computeMembershipStats([], null).avgPerChapter).toBeNull();
  });

  it("uses the sheet's total when provided", () => {
    expect(computeMembershipStats([chapter()], summary({ total_members: 1400 })).totalMembers).toBe(1400);
  });
});

describe("status / RSO breakdowns", () => {
  it("reads status counts from the summary when present", () => {
    expect(computeStatusBreakdown([], summary())).toEqual({ active: 4, inactive: 0, pendingLaunch: 2 });
  });

  it("counts the roster when there's no summary", () => {
    const b = computeStatusBreakdown(
      [chapter({ status: "active" }), chapter({ status: "pending_launch" }), chapter({ status: "pending_launch" })],
      null
    );
    expect(b).toEqual({ active: 1, inactive: 0, pendingLaunch: 2 });
  });

  it("RSO breakdown is null (no data) without a summary, and passes real values through", () => {
    expect(computeRsoBreakdown(null)).toEqual({ recognized: null, pending: null, notRecognized: null, expired: null });
    expect(computeRsoBreakdown(summary()).pending).toBe(7);
    expect(computeRsoBreakdown(summary({ rso_expired: null })).expired).toBeNull();
  });
});

describe("computeTrendSeries", () => {
  it("groups snapshots by date, sorts them, and sums members", () => {
    const t = computeTrendSeries([
      snapshot({ chapter_external_id: "a", snapshot_date: "2026-09-02", member_count: 5 }),
      snapshot({ chapter_external_id: "b", snapshot_date: "2026-09-02", member_count: 7 }),
      snapshot({ chapter_external_id: "a", snapshot_date: "2026-09-01", member_count: 4 }),
    ]);
    expect(t).toEqual([
      { date: "2026-09-01", chapters: 1, members: 4 },
      { date: "2026-09-02", chapters: 2, members: 12 },
    ]);
  });

  it("counts every roster row, not just active ones — the sheet roster has no per-row status", () => {
    const t = computeTrendSeries([snapshot({ status: null }), snapshot({ chapter_external_id: "b", status: null })]);
    expect(t[0].chapters).toBe(2);
  });

  it("is empty for no snapshots", () => {
    expect(computeTrendSeries([])).toEqual([]);
  });
});

describe("signups", () => {
  it("builds daily + cumulative counts in date order and skips undated rows", () => {
    const t = computeSignupsTrend([signup("2026-09-03"), signup("2026-09-01"), signup("2026-09-01"), signup(null)]);
    expect(t).toEqual([
      { date: "2026-09-01", count: 2, cumulative: 2 },
      { date: "2026-09-03", count: 1, cumulative: 3 },
    ]);
  });

  it("countRecentSignups only counts the trailing window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    const rows = [signup("2026-09-29"), signup("2026-09-10"), signup("2026-08-01"), signup(null)];
    expect(countRecentSignups(rows, 30)).toBe(2);
    expect(countRecentSignups(rows, 3)).toBe(1);
  });
});

describe("computeRetention", () => {
  it("has no rate until there are two terms of history", () => {
    expect(computeRetention([]).retentionRate).toBeNull();
    expect(computeRetention([snapshot({ term: "2026-Fall" })]).retentionRate).toBeNull();
  });

  it("is the share of last term's active chapters still active this term", () => {
    const r = computeRetention([
      snapshot({ chapter_external_id: "a", term: "2026-Spring", status: "active" }),
      snapshot({ chapter_external_id: "b", term: "2026-Spring", status: "active" }),
      snapshot({ chapter_external_id: "a", term: "2026-Summer", status: "active" }),
      snapshot({ chapter_external_id: "b", term: "2026-Summer", status: "inactive" }),
    ]);
    expect(r.retentionRate).toBe(0.5);
    expect(r.previousTerm).toBe("2026-Spring");
    expect(r.currentTerm).toBe("2026-Summer");
  });
});

describe("computeTimeToCharter", () => {
  it("averages only chapters with both dates", () => {
    const t = computeTimeToCharter([
      chapter({ signup_date: "2026-01-01", charter_date: "2026-01-11" }),
      chapter({ signup_date: "2026-01-01", charter_date: "2026-01-21" }),
      chapter({ signup_date: "2026-01-01", charter_date: null }),
      chapter({ signup_date: null, charter_date: "2026-03-01" }),
    ]);
    expect(t).toEqual({ avgDays: 15, chaptersReporting: 2 });
  });

  it("is null when no chapter has both dates", () => {
    expect(computeTimeToCharter([chapter()])).toEqual({ avgDays: null, chaptersReporting: 0 });
  });
});

describe("computeEventBreakdown", () => {
  const event = (event_type: ChapterEventRow["event_type"], event_date: string | null = "2026-09-10"): ChapterEventRow => ({
    id: "e", external_id: "e", chapter_external_id: "c1", event_type, event_date,
    attendee_count: null, volunteer_hours: null, source: "airtable", created_at: "",
  });
  const TODAY = "2026-09-25";

  it("splits events into held (date today or earlier) and upcoming (still ahead) — the form is for planning", () => {
    const b = computeEventBreakdown(
      [event("Tabling", "2026-09-01"), event("Tabling", "2026-09-25"), event("Social", "2026-09-29")],
      TODAY
    );
    expect(b).toMatchObject({ total: 3, held: 2, upcoming: 1, undated: 0 });
  });

  it("counts events with no usable date as undated rather than guessing held/upcoming", () => {
    const b = computeEventBreakdown([event("Tabling", null), event("Tabling", "2026-09-01")], TODAY);
    expect(b).toMatchObject({ total: 2, held: 1, upcoming: 0, undated: 1 });
  });

  it("uses the form's own type labels, most common first, instead of a fixed list", () => {
    const b = computeEventBreakdown(
      [event("Event From Campaign"), event("Tabling"), event("Tabling"), event("Social")],
      TODAY
    );
    expect(b.byType.map((t) => [t.label, t.count])).toEqual([
      ["Tabling", 2],
      ["Event From Campaign", 1],
      ["Social", 1],
    ]);
  });

  it("files a missing type under 'Unspecified'", () => {
    const b = computeEventBreakdown([event(null), event("  ")], TODAY);
    expect(b.byType).toEqual([{ type: "Unspecified", label: "Unspecified", count: 2 }]);
  });

  it("is empty with no events", () => {
    expect(computeEventBreakdown([], TODAY)).toEqual({ total: 0, held: 0, upcoming: 0, undated: 0, byType: [] });
  });
});
