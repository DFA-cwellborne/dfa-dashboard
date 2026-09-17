import type { ChapterSignup, SourceAdapter } from "@/lib/types/schema";
import { chapterFromMasterListRow, normalizeEventRow } from "./normalize";

// Mirrors the real Google Sheets Home tab + Chapter Master List tab +
// Airtable signups/events bases, so the mapping/parsing logic can be
// verified before real credentials are wired up. See googleSheetsAdapter.ts
// / airtableAdapter.ts for the real versions this stands in for.
const SCHOOL_NAMES = [
  "University of Oklahoma",
  "Abingdon High School",
  "Butler University",
  "University of Michigan",
  "North Carolina State University",
  "Westlake High School",
];

const STATES = ["OK", "VA", "IN", "MI", "NC", "TX"];

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createMockAdapter(): SourceAdapter {
  const roster = SCHOOL_NAMES.map((name, i) => ({
    row: [
      name,
      name.includes("High School") ? "HS" : "C",
      STATES[i],
      "President Name",
      "president@example.com",
      "(555) 555-0100",
      "",
      "",
      "Recognized",
      "Completed",
      i === 4 ? "Pending Launch" : "Active",
      i === 3 ? 0 : 3 + Math.floor(Math.random() * 60), // one chapter under-reporting, like the real sheet
    ],
  }));

  const signups: Record<string, unknown>[] = Array.from({ length: 14 }).map((_, i) => ({
    "Record ID": `rec-signup-${i}`,
    "School Name": randomFrom(SCHOOL_NAMES),
    "School Type": Math.random() > 0.5 ? "High School" : "College",
    "Submitted At": daysAgoIso(Math.floor(Math.random() * 120)),
    Status: randomFrom(["New", "Contacted", "Chartered"]),
  }));

  // Deliberately mixed casing/whitespace, like the real "which school" free-text field.
  const eventRows: Record<string, unknown>[] = Array.from({ length: 30 }).map((_, i) => ({
    "Record ID": `rec-event-${i}`,
    "Which school are you a part of": randomFrom(SCHOOL_NAMES.map((n) => (Math.random() > 0.5 ? n.toUpperCase() : n))),
    "Event Type": randomFrom(["Voter Registration Drive", "Tabling", "Social", "Training", "Other"]),
    "Event Date": daysAgoIso(Math.floor(Math.random() * 90)),
    "Attendee Count": 3 + Math.floor(Math.random() * 40),
  }));

  return {
    source: "manual",
    isConfigured: () => true,
    async fetchChapters() {
      return roster
        .map((r) => chapterFromMasterListRow(r.row))
        .filter((c): c is NonNullable<typeof c> => c !== null);
    },
    async fetchSummary() {
      return {
        totalChapters: roster.length,
        totalMembers: roster.reduce((sum, r) => sum + Number(r.row[11]), 0),
        activeChapters: roster.length - 2,
        statusCounts: { active: roster.length - 2, inactive: 0, pendingLaunch: 2 },
        rsoCounts: { recognized: roster.length - 1, pending: 1, notRecognized: 0, expired: 0 },
        source: "manual",
        raw: {},
      };
    },
    async fetchSignups(): Promise<ChapterSignup[]> {
      return signups.map((row) => ({
        externalId: String(row["Record ID"]),
        chapterName: String(row["School Name"]),
        schoolType: row["School Type"] === "High School" ? "HS" : "College",
        submittedAt: String(row["Submitted At"]),
        status: String(row["Status"]),
        source: "manual",
        raw: row,
      }));
    },
    async fetchEvents() {
      return eventRows
        .map((r) => normalizeEventRow(r, "manual"))
        .filter((e): e is NonNullable<typeof e> => e !== null);
    },
  };
}
