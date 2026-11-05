import { describe, expect, it } from "vitest";
import { slugifyName } from "@/lib/types/schema";
import { chapterFromMasterListRow, dedupeChapters, normalizeEventRow, normalizeSignupRow, publicMapChapterFromCsvRow } from "./normalize";

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
  // Field names exactly as the real Airtable event planning form sends them.
  const SCHOOL = "Which school are you the President of? (DO NOT SHORTEN UNIVERSITY)";
  const TYPE = "Pick an Event Type";
  const DATE = "What date is this event planning to take place on?";
  const event = (extra: Record<string, unknown> = {}) => ({
    "Record ID": "evt1",
    [SCHOOL]: "Crossroads College Prep",
    [TYPE]: "Event From Campaign",
    [DATE]: "2026-09-29",
    "What's the purpose of the event?": "free text we don't use",
    ...extra,
  });

  it("reads the real form's fields — regression: the event form was filled out but never showed up", () => {
    const e = normalizeEventRow(event(), "airtable")!;
    expect(e).toMatchObject({
      externalId: "evt1",
      chapterExternalId: "crossroads-college-prep",
      eventType: "Event From Campaign",
      eventDate: "2026-09-29",
    });
  });

  it("matches the school regardless of casing/whitespace (the free-text field drifts)", () => {
    const a = normalizeEventRow(event({ [SCHOOL]: "University of Oklahoma" }), "airtable")!;
    const b = normalizeEventRow(event({ [SCHOOL]: "  UNIVERSITY OF   oklahoma " }), "airtable")!;
    expect(a.chapterExternalId).toBe("university-of-oklahoma");
    expect(b.chapterExternalId).toBe(a.chapterExternalId);
  });

  it("survives the question being reworded, as long as it starts the same way", () => {
    const row = { "Record ID": "e", "Which school are you a part of?": "Rice University", [TYPE]: "Tabling" };
    expect(normalizeEventRow(row, "airtable")!.chapterExternalId).toBe("rice-university");
  });

  it("keeps the form's type label verbatim, so new dropdown options just work", () => {
    expect(normalizeEventRow(event({ [TYPE]: "Tabling" }), "airtable")!.eventType).toBe("Tabling");
    expect(normalizeEventRow(event({ [TYPE]: "Bake sale" }), "airtable")!.eventType).toBe("Bake sale");
  });

  it("uses 'Unspecified' when no type was picked", () => {
    const row = event();
    delete (row as Record<string, unknown>)[TYPE];
    expect(normalizeEventRow(row, "airtable")!.eventType).toBe("Unspecified");
  });

  it("keeps an event with an unreadable date (undated) instead of dropping it", () => {
    expect(normalizeEventRow(event({ [DATE]: "sometime soon" }), "airtable")!.eventDate).toBeNull();
    expect(normalizeEventRow(event({ [DATE]: "sometime soon" }), "airtable")).not.toBeNull();
  });

  it("drops rows missing an id or a school", () => {
    expect(normalizeEventRow(event({ [SCHOOL]: "" }), "airtable")).toBeNull();
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
      { "Record ID": "e1", "Which school are you the President of? (DO NOT SHORTEN UNIVERSITY)": "Rice University", "What's your first and last name?": "Anna McCandless", Question: "amccandless@school.org" },
      "airtable"
    );
    expect(e).not.toBeNull();
    expect(leaked(e)).toEqual([]);
    expect(e).not.toHaveProperty("raw");
  });
});

describe("dedupeChapters", () => {
  const c = (name: string, extra: Partial<ReturnType<typeof chapterFromMasterListRow>> = {}) =>
    ({ ...chapterFromMasterListRow(["", "C", "TX", "", "", "", "", "", "", "", "Active", "0"])!, name, externalId: name.toLowerCase().replace(/\s+/g, "-"), ...extra }) as NonNullable<ReturnType<typeof chapterFromMasterListRow>>;

  it("keeps a chapter listed once", () => {
    const { chapters, duplicates } = dedupeChapters([c("Rice University")]);
    expect(chapters).toHaveLength(1);
    expect(duplicates).toEqual([]);
  });

  it("regression: two rows with the same name collided silently, with the winner depending on fetch order — now the first (top-to-bottom sheet order) always wins", () => {
    const first = c("Minnetonka High School", { status: "active" });
    const second = c("Minnetonka High School", { status: "pending_launch" });
    const { chapters, duplicates } = dedupeChapters([first, second]);
    expect(chapters).toEqual([first]);
    expect(duplicates).toEqual(["Minnetonka High School"]);
  });

  it("is stable regardless of which duplicate appears first — always keeps whichever is literally first in the input", () => {
    const first = c("Minnetonka High School", { status: "pending_launch" });
    const second = c("Minnetonka High School", { status: "active" });
    expect(dedupeChapters([first, second]).chapters[0].status).toBe("pending_launch");
    expect(dedupeChapters([second, first]).chapters[0].status).toBe("active");
  });

  it("reports every duplicate past the first, for 3+ copies of the same chapter", () => {
    const { chapters, duplicates } = dedupeChapters([c("X"), c("X"), c("X")]);
    expect(chapters).toHaveLength(1);
    expect(duplicates).toEqual(["X", "X"]);
  });

  it("doesn't confuse two different chapters, or flag unrelated chapters as duplicates", () => {
    const { chapters, duplicates } = dedupeChapters([c("Rice University"), c("Butler University")]);
    expect(chapters).toHaveLength(2);
    expect(duplicates).toEqual([]);
  });

  it("handles an empty list", () => {
    expect(dedupeChapters([])).toEqual({ chapters: [], duplicates: [] });
  });
});

describe("publicMapChapterFromCsvRow", () => {
  const row = (extra: Record<string, string> = {}) => ({
    school: "Rice University", type: "College", state: "TX", city: "Houston",
    lat: "29.7174", lng: "-95.4018", status: "active", president: "Jane D.",
    link: "https://community.dreamforamerica.breakthruapp.com/dfa-rice",
    ...extra,
  });

  it("maps a well-formed active row", () => {
    const c = publicMapChapterFromCsvRow(row())!;
    expect(c).toMatchObject({
      externalId: "rice-university", school: "Rice University", type: "College",
      state: "TX", city: "Houston", lat: 29.7174, lng: -95.4018, status: "active",
      president: "Jane D.", source: "public_map",
    });
  });

  it("collapses any non-'active' status (including the real 'launching' value, blanks, and typos) to 'launching' — matches the live map's own rule", () => {
    expect(publicMapChapterFromCsvRow(row({ status: "launching" }))!.status).toBe("launching");
    expect(publicMapChapterFromCsvRow(row({ status: "" }))!.status).toBe("launching");
    expect(publicMapChapterFromCsvRow(row({ status: "Active " }))!.status).toBe("active"); // trims/case-insensitive
    expect(publicMapChapterFromCsvRow(row({ status: "pending" }))!.status).toBe("launching");
  });

  it("drops a row with no school name", () => {
    expect(publicMapChapterFromCsvRow(row({ school: "" }))).toBeNull();
  });

  it("drops a row with a missing or non-numeric lat/lng rather than guessing — matches the live map dropping such rows from the map entirely", () => {
    expect(publicMapChapterFromCsvRow(row({ lat: "" }))).toBeNull();
    expect(publicMapChapterFromCsvRow(row({ lng: "" }))).toBeNull();
    expect(publicMapChapterFromCsvRow(row({ lat: "not-a-number" }))).toBeNull();
  });

  it("treats optional fields (type, city, president, link) as null when blank, not empty strings", () => {
    const c = publicMapChapterFromCsvRow(row({ type: "", city: "", president: "", link: "" }))!;
    expect(c).toMatchObject({ type: null, city: null, president: null, link: null });
  });

  it("slugifies the school name the same way as the Chapter Master List, so ids are built consistently project-wide", () => {
    expect(publicMapChapterFromCsvRow(row({ school: "  University of Oklahoma " }))!.externalId).toBe(
      "university-of-oklahoma"
    );
  });
});
