import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ChapterEventRow,
  ChapterRow,
  ChapterSignupRow,
  ChapterSnapshotRow,
  PublicMapChapterRow,
  PublicMapSnapshotRow,
  SheetSummaryRow,
} from "@/lib/types/database";
import {
  computeChapterCounts,
  computeEventBreakdown,
  computeGoalProgress,
  computeGoalTrend,
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
  source: "google_sheets", created_at: "", updated_at: "",
  rso_status: null, charter_status: null, staff_contact: null, last_event_date: null, notes: null, link: null,
  ...o,
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

const mapChapter = (id: string): PublicMapChapterRow => ({
  external_id: id, school: id, type: "College", state: "TX", city: "Houston", lat: 29.7, lng: -95.4,
  status: "active", president: null, link: null, source: "public_map", created_at: "", updated_at: "",
});

const mapSnapshot = (o: Partial<PublicMapSnapshotRow>): PublicMapSnapshotRow => ({
  id: "s", snapshot_date: "2026-09-01", active_count: 0, launching_count: 0, created_at: "", ...o,
});

afterEach(() => vi.useRealTimers());

describe("computeChapterCounts", () => {
  it("counts the real roster rather than the Home tab's headline cells — those drift stale (e.g. stuck at \"4 active\" while the roster and the sheet's own Status table both said otherwise)", () => {
    const c = computeChapterCounts(
      [chapter({ status: "active" }), chapter({ external_id: "c2", status: "active" }), chapter({ external_id: "c3", status: "inactive" })],
      summary({ total_chapters: 6, active_chapters: 4 }) // deliberately wrong/stale, must be ignored
    );
    expect(c.total).toBe(3);
    expect(c.active).toBe(2);
  });

  it("falls back to the sheet's headline totals only when the roster came back empty (a sync gap)", () => {
    const c = computeChapterCounts([], summary({ total_chapters: 6, active_chapters: 4 }));
    expect(c.total).toBe(6);
    expect(c.active).toBe(4);
  });

  it("is zero, not a crash, with no roster and no summary", () => {
    expect(computeChapterCounts([], null)).toMatchObject({ total: 0, active: 0 });
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

  it("sums the real roster rather than the Home tab's headline member total, which can drift stale the same way the chapter counts do", () => {
    const m = computeMembershipStats(
      [chapter({ member_count: 5 }), chapter({ external_id: "c2", member_count: 7 })],
      summary({ total_members: 1400 }) // deliberately wrong/stale, must be ignored
    );
    expect(m.totalMembers).toBe(12);
  });

  it("falls back to the sheet's headline member total only when the roster came back empty", () => {
    expect(computeMembershipStats([], summary({ total_members: 1400 })).totalMembers).toBe(1400);
  });
});

describe("status / RSO breakdowns", () => {
  it("counts the roster even when a summary is also present — regression: the Home tab's Status-table formula counted a duplicate chapter row that the roster itself had already deduped, so the two disagreed (hero card: 11 total; breakdown card: 10+1+1=12)", () => {
    const b = computeStatusBreakdown(
      [chapter({ status: "active" }), chapter({ external_id: "c2", status: "inactive" })],
      summary({ status_active: 10, status_inactive: 1, status_pending_launch: 1 }) // stale/mismatched, must be ignored
    );
    expect(b).toEqual({ active: 1, inactive: 1, pendingLaunch: 0 });
  });

  it("counts the roster when there's no summary", () => {
    const b = computeStatusBreakdown(
      [chapter({ status: "active" }), chapter({ status: "pending_launch" }), chapter({ status: "pending_launch" })],
      null
    );
    expect(b).toEqual({ active: 1, inactive: 0, pendingLaunch: 2 });
  });

  it("falls back to the summary only when the roster is empty (a sync gap)", () => {
    expect(computeStatusBreakdown([], summary())).toEqual({ active: 4, inactive: 0, pendingLaunch: 2 });
  });

  it("is null (no data), not zero, when both the roster and the summary are empty", () => {
    expect(computeStatusBreakdown([], null)).toEqual({ active: null, inactive: null, pendingLaunch: null });
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

describe("computeGoalProgress", () => {
  const GOALS = [
    { label: "End of 2026", target: 50, deadline: "2026-12-31" },
    { label: "End of 2027", target: 250, deadline: "2027-12-31" },
  ];

  it("counts every public-map chapter — the table only has active/launching rows, so a row count already is 'active + pipeline'", () => {
    const chapters = [mapChapter("a"), mapChapter("b"), mapChapter("c")];
    const [first] = computeGoalProgress(chapters, "2026-01-01", GOALS);
    expect(first.current).toBe(3);
  });

  it("computes pct toward target and days remaining to the deadline", () => {
    const chapters = Array.from({ length: 25 }, (_, i) => mapChapter(`c${i}`));
    const [first] = computeGoalProgress(chapters, "2026-12-01", GOALS);
    expect(first.pct).toBe(0.5);
    expect(first.met).toBe(false);
    expect(first.daysRemaining).toBe(30);
    expect(first.deadlinePassed).toBe(false);
  });

  it("clamps pct at 1 when the goal is already exceeded, and flags it met", () => {
    const chapters = Array.from({ length: 60 }, (_, i) => mapChapter(`c${i}`));
    const [first] = computeGoalProgress(chapters, "2026-01-01", GOALS);
    expect(first.pct).toBe(1);
    expect(first.met).toBe(true);
  });

  it("clamps daysRemaining at 0 and flags deadlinePassed once the deadline is behind us, instead of going negative", () => {
    const chapters = [mapChapter("a")];
    const [first] = computeGoalProgress(chapters, "2027-03-01", GOALS);
    expect(first.daysRemaining).toBe(0);
    expect(first.deadlinePassed).toBe(true);
  });

  it("treats the deadline date itself as not yet passed", () => {
    const [first] = computeGoalProgress([mapChapter("a")], "2026-12-31", GOALS);
    expect(first.deadlinePassed).toBe(false);
    expect(first.daysRemaining).toBe(0);
  });

  it("returns one entry per goal, independent of each other", () => {
    const chapters = Array.from({ length: 50 }, (_, i) => mapChapter(`c${i}`));
    const progress = computeGoalProgress(chapters, "2026-01-01", GOALS);
    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ label: "End of 2026", target: 50, met: true });
    expect(progress[1]).toMatchObject({ label: "End of 2027", target: 250, met: false });
  });
});

describe("computeGoalTrend", () => {
  it("sums active + launching per day and sorts chronologically", () => {
    const trend = computeGoalTrend([
      mapSnapshot({ snapshot_date: "2026-09-03", active_count: 10, launching_count: 20 }),
      mapSnapshot({ snapshot_date: "2026-09-01", active_count: 5, launching_count: 8 }),
    ]);
    expect(trend).toEqual([
      { date: "2026-09-01", value: 13 },
      { date: "2026-09-03", value: 30 },
    ]);
  });

  it("is empty with no snapshots", () => {
    expect(computeGoalTrend([])).toEqual([]);
  });
});
