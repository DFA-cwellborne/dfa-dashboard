// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { computeGoalProgress, computeGoalTrend, type Goal } from "@/lib/metrics/compute";
import type { PublicMapChapterRow, PublicMapSnapshotRow } from "@/lib/types/database";
import { GoalProgress } from "./GoalProgress";

afterEach(cleanup);

const GOALS: Goal[] = [
  { label: "End of 2026", target: 50, deadline: "2026-12-31" },
  { label: "End of 2027", target: 250, deadline: "2027-12-31" },
];

const mapChapter = (id: string): PublicMapChapterRow => ({
  external_id: id, school: id, type: "College", state: "TX", city: "Houston", lat: 29.7, lng: -95.4,
  status: "active", president: null, link: null, source: "public_map", created_at: "", updated_at: "",
});

const snapshot = (o: Partial<PublicMapSnapshotRow>): PublicMapSnapshotRow => ({
  id: "s", snapshot_date: "2026-09-01", active_count: 0, launching_count: 0, created_at: "", ...o,
});

function renderGoals(chapterCount: number, today = "2026-11-05") {
  const chapters: PublicMapChapterRow[] = Array.from({ length: chapterCount }, (_, i) => mapChapter(`c${i}`));
  const goals = computeGoalProgress(chapters, today, GOALS);
  const trend = computeGoalTrend([snapshot({ snapshot_date: "2026-09-01", active_count: 10, launching_count: 15 })]);
  render(<GoalProgress goals={goals} trend={trend} />);
}

describe("GoalProgress", () => {
  it("shows current/target for each goal", () => {
    renderGoals(25);
    // Both goals track the same underlying chapter count, so "25" appears twice — once per goal card.
    expect(screen.getAllByText("25")).toHaveLength(2);
    expect(screen.getByText("/ 50 chapters")).toBeTruthy();
    expect(screen.getByText("/ 250 chapters")).toBeTruthy();
  });

  it("shows both goal labels", () => {
    renderGoals(25);
    expect(screen.getByText("End of 2026")).toBeTruthy();
    expect(screen.getByText("End of 2027")).toBeTruthy();
  });

  it("shows days remaining when a goal is still open", () => {
    renderGoals(25, "2026-12-01");
    expect(screen.getByText("30 days left")).toBeTruthy();
  });

  it("shows 'Goal met' instead of a countdown once the target is reached", () => {
    renderGoals(50, "2026-01-01");
    expect(screen.getAllByText("Goal met")).toHaveLength(1);
  });

  it("shows 'Deadline passed' for a goal whose date is behind us and unmet", () => {
    renderGoals(10, "2027-06-01");
    expect(screen.getByText("Deadline passed")).toBeTruthy();
  });

  it("gives each progress bar an accessible role and label with the real numbers", () => {
    renderGoals(25, "2026-12-01");
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0].getAttribute("aria-label")).toContain("25 of 50 chapters");
    expect(bars[0].getAttribute("aria-valuenow")).toBe("25");
    expect(bars[0].getAttribute("aria-valuemax")).toBe("50");
  });

  it("renders a trend chart section", () => {
    renderGoals(25);
    expect(screen.getByText("Chapters Over Time")).toBeTruthy();
  });
});
