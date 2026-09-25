import { describe, expect, it } from "vitest";
import { slugifyName } from "@/lib/types/schema";
import { chapterFromMasterListRow, normalizeEventRow, normalizeSignupRow } from "./normalize";

// Column order of the "Chapter Master List" tab:
// School, C/H, State, Pres name, email, phone, Breakthru, Membership sheet,
// RSO Status, Charter Status, Status, Member Count, Last Event, Notes
function masterRow(overrides: Record<number, unknown> = {}): unknown[] {
  const base: unknown[] = [
    "Butler University", "C", "IN", "Jane Doe", "j@example.com", "(555) 555-0100",
    "", "", "Recognized", "Completed", "Active", "9", "", "",
  ];
  for (const [i, v] of Object.entries(overrides)) base[Number(i)] = v;
  return base;
}

describe("slugifyName", () => {
  it("is case-, whitespace- and punctuation-insensitive", () => {
    expect(slugifyName("Ohio State")).toBe("ohio-state");
    expect(slugifyName("  OHIO   state ")).toBe("ohio-state");
    expect(slugifyName("St. John's University")).toBe("st-john-s-university");
  });
});

describe("chapterFromMasterListRow", () => {
  it("maps type, state, status, and member count", () => {
    const c = chapterFromMasterListRow(masterRow())!;
    expect(c).toMatchObject({
      externalId: "butler-university",
      name: "Butler University",
      schoolType: "College",
      state: "IN",
      status: "active",
      memberCount: 9,
      source: "google_sheets",
    });
  });

  it("maps HS and Pending Launch", () => {
    const c = chapterFromMasterListRow(masterRow({ 0: "Abingdon High School", 1: "HS", 10: "Pending Launch" }))!;
    expect(c.schoolType).toBe("HS");
    expect(c.status).toBe("pending_launch");
  });

  it("skips the [SCHOOL] template row and blank rows", () => {
    expect(chapterFromMasterListRow(masterRow({ 0: "[SCHOOL]" }))).toBeNull();
    expect(chapterFromMasterListRow(["", "", "", "", "", "", "", "", "", "", "", "0"])).toBeNull();
    expect(chapterFromMasterListRow([])).toBeNull();
  });

  it("distinguishes 'not reported' (null) from a real zero — never coerces missing to 0", () => {
    expect(chapterFromMasterListRow(masterRow({ 11: "0" }))!.memberCount).toBe(0);
    expect(chapterFromMasterListRow(masterRow({ 11: "" }))!.memberCount).toBeNull();
    // Sheets API drops trailing empty cells, so short rows are normal:
    expect(chapterFromMasterListRow(["Solo College", "C", "TX"])!.memberCount).toBeNull();
  });

  it("leaves unrecognized type/status null instead of guessing", () => {
    const c = chapterFromMasterListRow(masterRow({ 1: "??", 10: "Sleeping" }))!;
    expect(c.schoolType).toBeNull();
    expect(c.status).toBeNull();
  });

  it("trims names and slugs them for a stable id", () => {
    const c = chapterFromMasterListRow(masterRow({ 0: "  University of Oklahoma " }))!;
    expect(c.name).toBe("University of Oklahoma");
    expect(c.externalId).toBe("university-of-oklahoma");
  });
});

describe("normalizeSignupRow", () => {
  const signup = (extra: Record<string, unknown>) => ({
    "Record ID": "rec1",
    "Created Time": "2026-09-01T12:00:00.000Z",
    "School Name (No Abbreviations)": "Rice University",
    "Student Type": "College",
    ...extra,
  });

  it("keeps submissions that asked to start/join a chapter", () => {
    const s = normalizeSignupRow(signup({ "How would you like to get involved?": ["Start a chapter", "Volunteer"] }), "airtable")!;
    expect(s).toMatchObject({ externalId: "rec1", chapterName: "Rice University", schoolType: "College", submittedAt: "2026-09-01" });
  });

  it("matches the intent case-insensitively, in either intent field, string or array", () => {
    expect(normalizeSignupRow(signup({ "How would you like to get involved?": "Join a CHAPTER" }), "airtable")).not.toBeNull();
    expect(normalizeSignupRow(signup({ "How would you like to get involved? (Non-Students)": ["Start a chapter"] }), "airtable")).not.toBeNull();
  });

  it("drops general-interest submissions that never mention a chapter", () => {
    expect(normalizeSignupRow(signup({ "How would you like to get involved?": ["Email updates", "Careers"] }), "airtable")).toBeNull();
    expect(normalizeSignupRow(signup({}), "airtable")).toBeNull();
  });

  it("drops rows without a record id", () => {
    const row = signup({ "How would you like to get involved?": ["Start a chapter"] });
    delete (row as Record<string, unknown>)["Record ID"];
    expect(normalizeSignupRow(row, "airtable")).toBeNull();
  });

  it("maps 'High School' to HS", () => {
    const s = normalizeSignupRow(signup({ "Student Type": "High School", "How would you like to get involved?": ["Start a chapter"] }), "airtable")!;
    expect(s.schoolType).toBe("HS");
  });
});

describe("normalizeEventRow", () => {
  const event = (extra: Record<string, unknown>) => ({
    "Record ID": "evt1",
    "Which school are you a part of": "University of Oklahoma",
    "Event Type": "Tabling",
    "Event Date": "2026-09-10",
    ...extra,
  });

  it("matches the school regardless of casing/whitespace (the free-text field drifts)", () => {
    const a = normalizeEventRow(event({}), "airtable")!;
    const b = normalizeEventRow(event({ "Which school are you a part of": "  UNIVERSITY OF   oklahoma " }), "airtable")!;
    expect(a.chapterExternalId).toBe("university-of-oklahoma");
    expect(b.chapterExternalId).toBe(a.chapterExternalId);
  });

  it("maps known event types and falls back to 'other'", () => {
    expect(normalizeEventRow(event({ "Event Type": "Voter Registration Drive" }), "airtable")!.eventType).toBe("voter_registration");
    expect(normalizeEventRow(event({ "Event Type": "Bake sale" }), "airtable")!.eventType).toBe("other");
  });

  it("drops rows missing an id or a school", () => {
    expect(normalizeEventRow(event({ "Which school are you a part of": "" }), "airtable")).toBeNull();
    expect(normalizeEventRow(event({ "Record ID": "" }), "airtable")).toBeNull();
  });
});

// Regression: the sync once stored every source row verbatim in a table the
// public site could read — leaking presidents' and signups' names, emails and
// phone numbers. Normalizers must only ever emit the fields the dashboard uses.
describe("personal data never passes through normalization", () => {
  const PII = ["zellgrady@gmail.com", "(612) 419-4776", "Zell Grady", "55401", "amccandless@school.org", "Anna McCandless"];
  const leaked = (out: unknown) => PII.filter((p) => JSON.stringify(out).includes(p));

  it("chapters", () => {
    const c = chapterFromMasterListRow(["Minnetonka High School", "HS", "MN", "Zell Grady", "zellgrady@gmail.com", "(612) 419-4776", "", "", "Recognized", "Completed", "Active", "0"]);
    expect(c).not.toBeNull();
    expect(leaked(c)).toEqual([]);
    expect(c).not.toHaveProperty("raw");
  });

  it("signups", () => {
    const s = normalizeSignupRow(
      {
        "Record ID": "rec1", "Created Time": "2026-09-01T00:00:00.000Z", "First Name": "Abigail", "Last Name": "Smith",
        Email: "amccandless@school.org", Phone: "(612) 419-4776", "Zip Code": "55401",
        "School Name (No Abbreviations)": "Rice University", "How would you like to get involved?": ["Start a chapter"],
      },
      "airtable"
    );
    expect(s).not.toBeNull();
    expect(leaked(s)).toEqual([]);
    expect(JSON.stringify(s)).not.toMatch(/Abigail|Smith/);
    expect(s).not.toHaveProperty("raw");
  });

  it("events", () => {
    const e = normalizeEventRow(
      { "Record ID": "e1", "Which school are you a part of": "Rice University", "What's your first and last name?": "Anna McCandless", Question: "amccandless@school.org" },
      "airtable"
    );
    expect(e).not.toBeNull();
    expect(leaked(e)).toEqual([]);
    expect(e).not.toHaveProperty("raw");
  });
});
