// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DashboardData, SyncLogSummary } from "@/lib/data/queries";
import { getDashboardData, getSyncLogSummary } from "@/lib/data/queries";
import { Overview } from "./Overview";

vi.mock("@/lib/data/queries", () => ({
  getDashboardData: vi.fn(),
  getSyncLogSummary: vi.fn(),
}));
// Recharts needs real layout (ResizeObserver etc.) — irrelevant to what's under test.
vi.mock("@/components/charts/TrendLineChart", () => ({ TrendLineChart: () => null }));
vi.mock("@/components/charts/RangeTrendChart", () => ({ RangeTrendChart: () => null }));
vi.mock("@/components/charts/EventTypeBarChart", () => ({ EventTypeBarChart: () => null }));
// Render the raw timestamp so tests can tell one check time from another.
vi.mock("@/components/ui/RelativeTime", () => ({ RelativeTime: ({ date }: { date: string }) => date }));

const mockData = vi.mocked(getDashboardData);
const mockLog = vi.mocked(getSyncLogSummary);

const SYNC = {
  id: "s1", source: "google_sheets", success: true, started_at: "2026-09-25T15:00:00Z",
  finished_at: "2026-09-25T15:00:05Z", records_processed: 7, errors: [], created_at: "2026-09-25T15:00:05Z",
};

const DATA: DashboardData = {
  configured: true,
  chapters: [
    { id: "1", external_id: "butler", name: "Butler University", school_type: "College", status: "active", state: "IN", locale: null, member_count: 9, signup_date: null, charter_date: null, term: null, source: "google_sheets", created_at: "", updated_at: "" },
  ],
  snapshots: [], events: [], signups: [],
  summary: { id: "default", total_chapters: 6, total_members: 9, active_chapters: 4, status_active: 4, status_inactive: 0, status_pending_launch: 2, rso_recognized: 5, rso_pending: 7, rso_not_recognized: 0, rso_expired: 0, synced_at: "" },
  latestSync: SYNC,
};
const LOG: SyncLogSummary = { bySource: { google_sheets: SYNC }, recent: [SYNC] };

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo; // jsdom doesn't implement it
  mockData.mockReset().mockResolvedValue(DATA);
  mockLog.mockReset().mockResolvedValue(LOG);
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const status = () => screen.getByTestId("refresh-status").textContent ?? "";
const refreshButton = () => screen.getByRole("button", { name: "Refresh data" }) as HTMLButtonElement;
const checkedAt = () => status().match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/)?.[0] ?? "";

describe("Overview", () => {
  it("loads from Supabase on mount and renders the dashboard", async () => {
    render(<Overview />);
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(await screen.findByText("Active Chapters")).toBeTruthy();
    expect(mockData).toHaveBeenCalledTimes(1);
  });

  describe("Stats / Map views", () => {
    const tab = (name: string) => screen.getByRole("tab", { name }) as HTMLButtonElement;

    it("opens on Stats, with the map on its own view rather than crowding the stats page", async () => {
      render(<Overview />);
      await screen.findByText("Active Chapters");
      expect(tab("Stats").getAttribute("aria-selected")).toBe("true");
      expect(tab("Map").getAttribute("aria-selected")).toBe("false");
      expect(screen.queryByText("Chapter Map")).toBeNull();
    });

    it("switches to the map and hides the stats", async () => {
      render(<Overview />);
      await screen.findByText("Active Chapters");
      fireEvent.click(tab("Map"));

      expect(await screen.findByText("Chapter Map")).toBeTruthy();
      expect(screen.getAllByTestId("chapter-dot")).toHaveLength(1);
      expect(screen.queryByText("Active Chapters")).toBeNull();
      expect(tab("Map").getAttribute("aria-selected")).toBe("true");
      expect(window.location.hash).toBe("#map");
    });

    it("switches back to the stats", async () => {
      render(<Overview />);
      await screen.findByText("Active Chapters");
      fireEvent.click(tab("Map"));
      await screen.findByText("Chapter Map");
      fireEvent.click(tab("Stats"));
      expect(await screen.findByText("Active Chapters")).toBeTruthy();
      expect(screen.queryByText("Chapter Map")).toBeNull();
    });

    it("stays on the map after a refresh, because the view lives in the URL (#map)", async () => {
      window.location.hash = "#map";
      render(<Overview />);
      expect(await screen.findByText("Chapter Map")).toBeTruthy();
      expect(screen.queryByText("Active Chapters")).toBeNull();
    });

    it("doesn't refetch when switching views — both views share one load", async () => {
      render(<Overview />);
      await screen.findByText("Active Chapters");
      fireEvent.click(tab("Map"));
      await screen.findByText("Chapter Map");
      fireEvent.click(tab("Stats"));
      await screen.findByText("Active Chapters");
      expect(mockData).toHaveBeenCalledTimes(1);
    });

    it("keeps the refresh controls and status on both views", async () => {
      render(<Overview />);
      await screen.findByText("Active Chapters");
      fireEvent.click(tab("Map"));
      await screen.findByText("Chapter Map");
      expect(screen.getByRole("button", { name: "Refresh data" })).toBeTruthy();
      expect(status()).toMatch(/^Page checked /);
    });

    it("can be driven from the keyboard with the arrow keys", async () => {
      render(<Overview />);
      await screen.findByText("Active Chapters");
      fireEvent.keyDown(tab("Stats"), { key: "ArrowRight" });
      expect(await screen.findByText("Chapter Map")).toBeTruthy();
    });
  });

  it("shows both when data last synced and when this page last checked", async () => {
    render(<Overview />);
    await screen.findByText("Active Chapters");
    expect(screen.getByTestId("data-as-of").textContent).toMatch(/^Last synced: Sep 25, 2026/);
    expect(status()).toMatch(/^Page checked \d{4}-\d{2}-\d{2}T/);
  });

  it("clicking refresh re-queries AND visibly updates the 'Checked' time — even when nothing new synced", async () => {
    render(<Overview />);
    await screen.findByText("Active Chapters");
    const before = checkedAt();
    expect(mockData).toHaveBeenCalledTimes(1);

    fireEvent.click(refreshButton());

    // Spinner is held so the click is visibly acknowledged (button disabled while refreshing).
    await waitFor(() => expect(refreshButton().disabled).toBe(true));
    await waitFor(() => expect(refreshButton().disabled).toBe(false), { timeout: 3000 });

    expect(mockData).toHaveBeenCalledTimes(2);
    expect(mockLog).toHaveBeenCalledTimes(2);
    const after = checkedAt();
    expect(after).not.toBe(before);
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
    // The sync time is unchanged — that's the sync job's, not the page's.
    expect(screen.getByTestId("data-as-of").textContent).toMatch(/^Last synced: Sep 25, 2026/);
  });

  it("re-checks when the tab regains focus", async () => {
    render(<Overview />);
    await screen.findByText("Active Chapters");
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(mockData).toHaveBeenCalledTimes(2));
  });

  it("keeps showing the last good data if a background refresh fails, and says so", async () => {
    render(<Overview />);
    await screen.findByText("Active Chapters");

    mockData.mockRejectedValueOnce(new Error("Supabase query failed: fetch failed"));
    fireEvent.click(refreshButton());

    await waitFor(() => expect(status()).toMatch(/Couldn.t refresh/));
    // Not blanked:
    expect(screen.getByText("Active Chapters")).toBeTruthy();
    expect(screen.getAllByText("Butler University").length).toBeGreaterThan(0);
  });

  it("recovers on the next successful refresh", async () => {
    render(<Overview />);
    await screen.findByText("Active Chapters");
    mockData.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(refreshButton());
    await waitFor(() => expect(status()).toMatch(/Couldn.t refresh/));
    await waitFor(() => expect(refreshButton().disabled).toBe(false), { timeout: 3000 });

    fireEvent.click(refreshButton());
    await waitFor(() => expect(status()).toMatch(/^Page checked /), { timeout: 3000 });
  });

  it("shows an error with Retry — not an endless 'Loading…' — if the very first load fails", async () => {
    mockData.mockRejectedValueOnce(new Error("offline"));
    render(<Overview />);
    expect(await screen.findByText(/Couldn.t load the dashboard/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Active Chapters", undefined, { timeout: 3000 })).toBeTruthy();
  });

  it("shows the setup notice when Supabase isn't configured", async () => {
    mockData.mockResolvedValue({ ...DATA, configured: false });
    render(<Overview />);
    expect(await screen.findByText("Connect Supabase to see data")).toBeTruthy();
  });

  it("explains that 'Page checked' and 'Data synced' are different things — regression: this looked like a bug", async () => {
    render(<Overview />);
    await screen.findByText("Active Chapters");
    // Both labels are distinct and visible (not just one overloaded "Synced" label)...
    expect(screen.getByTestId("data-as-of").textContent).toMatch(/^Last synced:/);
    expect(status()).toMatch(/^Page checked/);
    // ...and each has wording nearby (in the DOM, via a hover tooltip) saying why they
    // can legitimately show different times, so it doesn't read as broken.
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toMatch(/synced.*20 minutes/i);
  });

  it("opens the sync settings modal from the gear button", async () => {
    render(<Overview />);
    await screen.findByText("Active Chapters");
    fireEvent.click(screen.getByRole("button", { name: "Sync settings" }));
    expect(screen.getByRole("dialog", { name: "Sync Status" })).toBeTruthy();
  });
});
