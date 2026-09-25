// Canonical internal data schema for the DFA dashboard.
// Every data source (Google Sheets, Airtable, Breakthru) maps into these
// shapes before being written to Supabase — see src/config/sheetMapping.ts
// for the Sheets/Airtable column mapping layer.

export type SchoolType = "HS" | "College";
export type ChapterStatus = "active" | "inactive" | "pending_launch";
export type LocaleType = "urban" | "suburban" | "rural" | null;

export type DataSource = "google_sheets" | "airtable" | "breakthru" | "manual";

export interface Chapter {
  /** Stable external id — slugified chapter name (the sheet has no explicit id column). */
  externalId: string;
  name: string;
  schoolType: SchoolType | null;
  status: ChapterStatus | null;
  state: string | null;
  locale: LocaleType;
  memberCount: number | null;
  signupDate: string | null; // ISO date — when the chapter first signed up / submitted intake
  charterDate: string | null; // ISO date — when the chapter became officially active
  term: string | null; // e.g. "Fall 2026" — used for term-over-term retention
  source: DataSource;
}

/**
 * Aggregate counts read directly off the Google Sheets "Home" tab — the
 * sheet gives these as pre-computed totals, not derivable from the chapter
 * roster (which only has name + member count per row).
 */
export interface SheetSummary {
  totalChapters: number | null;
  totalMembers: number | null;
  activeChapters: number | null;
  statusCounts: {
    active: number | null;
    inactive: number | null;
    pendingLaunch: number | null;
  };
  rsoCounts: {
    recognized: number | null;
    pending: number | null;
    notRecognized: number | null;
    expired: number | null;
  };
  source: DataSource;
}

/** A "start a chapter" intake submission, from the Airtable signups base. */
export interface ChapterSignup {
  externalId: string;
  chapterName: string | null;
  schoolType: SchoolType | null;
  submittedAt: string | null;
  status: string | null;
  source: DataSource;
}

export type EventType =
  | "voter_registration"
  | "tabling"
  | "social"
  | "training"
  | "other";

export interface ChapterEvent {
  externalId: string;
  /** Slugified chapter/school name — matched case-insensitively to a Chapter's externalId. */
  chapterExternalId: string;
  eventType: EventType;
  eventDate: string | null;
  attendeeCount: number | null;
  volunteerHours: number | null;
  source: DataSource;
}

export interface SyncResult {
  source: DataSource;
  success: boolean;
  startedAt: string;
  finishedAt: string;
  recordsProcessed: number;
  errors: string[];
}

/**
 * Not every source models the same entities (Sheets gives a roster +
 * aggregate summary, Airtable gives signups + events, Breakthru only gives
 * people) — so every fetch method is optional; the orchestrator calls
 * whichever ones a given adapter implements.
 */
export interface SourceAdapter {
  source: DataSource;
  isConfigured(): boolean;
  fetchChapters?(): Promise<Chapter[]>;
  fetchSummary?(): Promise<SheetSummary>;
  fetchSignups?(): Promise<ChapterSignup[]>;
  fetchEvents?(): Promise<ChapterEvent[]>;
}

/** Turns a chapter/school name into a stable id, matched case/whitespace-insensitively. */
export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
