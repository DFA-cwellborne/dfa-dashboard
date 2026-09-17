// ---------------------------------------------------------------------------
// Single source of truth for translating the real DFA data sources into the
// dashboard's internal schema (src/lib/types/schema.ts). If a sheet/table
// layout changes, this is the only file that should need editing.
// ---------------------------------------------------------------------------

/**
 * The Google Sheet is a rolled-up "Home" dashboard, not a per-chapter data
 * table: fixed cells for headline totals, two small label/count tables for
 * status and RSO status breakdowns, and a simple name+members roster below
 * that. If Clayton rearranges the sheet, update the cell/range refs here —
 * nothing else needs to change.
 */
export const HOME_SHEET_LAYOUT = {
  totalChaptersCell: "B4",
  totalMembersCell: "B5",
  activeChaptersCell: "B6",
  // label/count pairs starting at this row; reading stops at the first blank label.
  statusTableRange: "A10:B20",
  rsoTableRange: "D10:E20",
  // Header row ("Chapter (School/Region)" / "Members") at row 17, data from
  // row 18 — the range includes the header since the parser skips row 0.
  chapterRosterRange: "A17:B500",
} as const;

export const STATUS_LABEL_MAP: Record<string, "active" | "inactive" | "pendingLaunch"> = {
  active: "active",
  inactive: "inactive",
  "pending launch": "pendingLaunch",
};

export const RSO_LABEL_MAP: Record<string, "recognized" | "pending" | "notRecognized" | "expired"> = {
  recognized: "recognized",
  pending: "pending",
  "not recognized": "notRecognized",
  expired: "expired",
};

/**
 * The "Chapter Master List" tab (a second tab in the same spreadsheet) is
 * the real per-chapter table — type, state, RSO/status, member count, one
 * row per chapter. Row 1 is a merged title, row 2 is the header, row 3 is a
 * "[SCHOOL]" template row (skipped by name), data starts row 4. The range
 * includes the header row since the parser skips row 0, same as the roster.
 */
export const CHAPTER_MASTER_LIST_LAYOUT = {
  sheetName: "Chapter Master List",
  dataRange: "A2:N220",
} as const;

export const MASTER_LIST_SCHOOL_TYPE_MAP: Record<string, "HS" | "College"> = {
  hs: "HS",
  c: "College",
};

export const MASTER_LIST_STATUS_MAP: Record<string, "active" | "inactive" | "pending_launch"> = {
  active: "active",
  inactive: "inactive",
  "pending launch": "pending_launch",
};

// ---------------------------------------------------------------------------
// Airtable — the "get involved" intake base. It's a general interest form
// (career opportunities, email updates, community involvement, etc.), not a
// dedicated "start a chapter" form — so we only count a submission as a
// chapter signup when one of the "how would you like to get involved"
// fields includes a chapter-related option (see wantsToStartOrJoinChapter
// in normalize.ts). Field names below are the real Airtable headers.
// ---------------------------------------------------------------------------
export const SIGNUP_FIELD_ALIASES = {
  externalId: ["Record ID"],
  chapterName: ["School Name (No Abbreviations)", "School Name", "Chapter Name", "School"],
  schoolType: ["Student Type", "School Type", "HS/College"],
  submittedAt: ["Created Time", "Submitted At", "Created", "Date Submitted", "Timestamp"],
  status: ["Status", "Application Status"],
} as const;

/** Fields holding the "how would you like to get involved" selections. */
export const SIGNUP_INTENT_FIELDS = [
  "How would you like to get involved?",
  "How would you like to get involved? (Non-Students)",
] as const;

// ---------------------------------------------------------------------------
// Airtable — events hosted by chapters (a separate base). The "which school"
// field is free text and may not match the sheet roster's casing/spacing —
// see slugifyName() in src/lib/types/schema.ts, used on both sides so
// "Ohio State", "ohio state", " Ohio State " all resolve to the same chapter.
// ---------------------------------------------------------------------------
export const EVENT_FIELD_ALIASES = {
  externalId: ["Record ID", "Event ID"],
  chapterExternalId: [
    "Which school are you a part of",
    "Which school are you a part of?",
    "School",
    "Chapter",
    "Chapter Name",
  ],
  eventType: ["Event Type", "Type"],
  eventDate: ["Event Date", "Date"],
  attendeeCount: ["Attendee Count", "# Attendees", "Attendance", "Number Registered"],
  volunteerHours: ["Volunteer Hours", "Hours Logged"],
} as const;

export const EVENT_TYPE_VALUE_MAP: Record<
  string,
  "voter_registration" | "tabling" | "social" | "training" | "other"
> = {
  "voter registration": "voter_registration",
  "voter registration drive": "voter_registration",
  tabling: "tabling",
  social: "social",
  socials: "social",
  training: "training",
  trainings: "training",
  onboarding: "training",
  "trainings/onboarding": "training",
  other: "other",
};

export const SCHOOL_TYPE_VALUE_MAP: Record<string, "HS" | "College"> = {
  "high school": "HS",
  hs: "HS",
  college: "College",
  university: "College",
  univ: "College",
};

/** Finds the first alias present as a key in `row`, case-insensitively. */
export function resolveHeader(row: Record<string, unknown>, aliases: readonly string[]) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((k) => k.trim().toLowerCase() === alias.trim().toLowerCase());
    if (match) return match;
  }
  return undefined;
}

export function getField(row: Record<string, unknown>, aliases: readonly string[]) {
  const header = resolveHeader(row, aliases);
  if (!header) return undefined;
  const value = row[header];
  if (value === "" || value === undefined || value === null) return undefined;
  return value;
}
