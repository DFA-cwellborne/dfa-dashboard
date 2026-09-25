import { describe, expect, it } from "vitest";
import { parseHomeSheet } from "./googleSheetsAdapter";

const HEADER = ["School / Region", "C/H", "State", "President Name", "President Email", "President Phone", "Breakthru", "Sheet", "RSO Status", "Charter Status", "Status", "Member Count", "Last Event Date", "Notes"];
const TEMPLATE = ["[SCHOOL]", "HS", "TX", "Jane Doe", "jane@example.com", "", "", "", "Recognized", "Completed", "Active", "4"];

function fixture(overrides: Partial<Parameters<typeof parseHomeSheet>[0]> = {}): Parameters<typeof parseHomeSheet>[0] {
  return {
    totalChapters: "6",
    totalMembers: "1,400",
    activeChapters: "4",
    statusRows: [["Active", "4"], ["Inactive", "0"], ["Pending Launch", "2"]],
    rsoRows: [["Recognized", "5"], ["Pending", "7"], ["Not Recognized", "0"], ["Expired", "0"]],
    masterListRows: [
      HEADER,
      TEMPLATE,
      ["University of Oklahoma", "C", "OK", "", "", "", "", "", "Recognized", "Completed", "Active", "0"],
      ["Abingdon High School", "HS", "VA", "", "", "", "", "", "Recognized", "Completed", "Pending Launch", "0"],
      ["", "", "", "", "", "", "", "", "", "", "", "0"],
    ],
    ...overrides,
  };
}

describe("parseHomeSheet", () => {
  it("reads the headline totals, tolerating thousands separators", () => {
    const { summary } = parseHomeSheet(fixture());
    expect(summary.totalChapters).toBe(6);
    expect(summary.totalMembers).toBe(1400);
    expect(summary.activeChapters).toBe(4);
  });

  it("reads status and RSO breakdowns by label", () => {
    const { summary } = parseHomeSheet(fixture());
    expect(summary.statusCounts).toEqual({ active: 4, inactive: 0, pendingLaunch: 2 });
    expect(summary.rsoCounts).toEqual({ recognized: 5, pending: 7, notRecognized: 0, expired: 0 });
  });

  it("matches labels case-insensitively", () => {
    const { summary } = parseHomeSheet(fixture({ statusRows: [["ACTIVE", "3"], ["pending launch", "1"]] }));
    expect(summary.statusCounts.active).toBe(3);
    expect(summary.statusCounts.pendingLaunch).toBe(1);
  });

  it("reports a category that's absent from the sheet as null, not zero", () => {
    const { summary } = parseHomeSheet(fixture({ statusRows: [["Active", "4"]], totalMembers: "" }));
    expect(summary.statusCounts.inactive).toBeNull();
    expect(summary.statusCounts.pendingLaunch).toBeNull();
    expect(summary.totalMembers).toBeNull();
  });

  it("stops reading a label/count table at the first blank label", () => {
    const { summary } = parseHomeSheet(fixture({ statusRows: [["Active", "4"], ["", ""], ["Inactive", "99"]] }));
    expect(summary.statusCounts.inactive).toBeNull();
  });

  it("returns every real chapter — regression: the first row after the header was once dropped", () => {
    const { chapters } = parseHomeSheet(fixture());
    expect(chapters.map((c) => c.name)).toEqual(["University of Oklahoma", "Abingdon High School"]);
  });

  it("skips the header, the [SCHOOL] template row, and trailing blank rows", () => {
    const { chapters } = parseHomeSheet(fixture());
    expect(chapters.some((c) => c.name === "School / Region" || c.name === "[SCHOOL]" || c.name === "")).toBe(false);
  });

  it("carries type/state/status through to each chapter", () => {
    const { chapters } = parseHomeSheet(fixture());
    expect(chapters[0]).toMatchObject({ schoolType: "College", state: "OK", status: "active" });
    expect(chapters[1]).toMatchObject({ schoolType: "HS", state: "VA", status: "pending_launch" });
  });

  it("yields no chapters and a null summary when the sheet is empty", () => {
    const { summary, chapters } = parseHomeSheet(
      fixture({ totalChapters: undefined, totalMembers: undefined, activeChapters: undefined, statusRows: [], rsoRows: [], masterListRows: [] })
    );
    expect(chapters).toEqual([]);
    expect(summary.totalChapters).toBeNull();
    expect(summary.statusCounts).toEqual({ active: null, inactive: null, pendingLaunch: null });
  });
});
