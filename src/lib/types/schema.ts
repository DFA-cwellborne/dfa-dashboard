// Canonical internal data schema for the DFA dashboard.
// Every data source (Google Sheets, Airtable, Breakthru) maps into these
// shapes before being written to Supabase — see src/config/sheetMapping.ts
// for the Sheets/Airtable column mapping layer.

export type SchoolType = "HS" | "College";
export type ChapterStatus = "active" | "inactive" | "pending_launch";
export type LocaleType = "urban" | "suburban" | "rural" | null;

export type DataSource = "google_sheets" | "airtable" | "breakthru" | "manual" | "public_map";

export type PublicMapStatus = "active" | "launching";

/**
 * One row from the public "Chapter Map" Google Sheet — the same sheet that
 * drives the live map at dreamforamerica.org/chapters/, published-to-web as
 * CSV. Deliberately a separate shape from `Chapter`: this sheet models a
 * different, overlapping-but-not-identical set of chapters (see
 * publicMapSync.ts for why it isn't merged with the Chapter Master List).
 */
export interface PublicMapChapter {
  externalId: string;
  school: string;
  type: string | null;
  state: string | null;
  city: string | null;
  lat: number;
  lng: number;
  status: PublicMapStatus;
  president: string | null;
  link: string | null;
  source: DataSource;
}

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
  /** Free text from the Master List's own "RSO Status"/"Charter Status" columns — per-chapter, unlike the sheet-level SheetSummary aggregate. */
  rsoStatus: string | null;
  charterStatus: string | null;
  /** Staff member assigned to this chapter ("Contact" column) — not the chapter's own president (that's deliberately never synced; see normalize.ts). */
  staffContact: string | null;
  lastEventDate: string | null; // ISO date, as hand-maintained on the sheet (distinct from Airtable's logged events)
  /** Free-text chapter update from the Master List's "Notes" column. */
  notes: string | null;
  /** Public Breakthru community link — same category of link already shown on the public map's pins. */
  link: string | null;
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


export interface ChapterEvent {
  externalId: string;
  /** Slugified chapter/school name — matched case-insensitively to a Chapter's externalId. */
  chapterExternalId: string;
  /** The event form's own type label, verbatim (e.g. "Tabling"). */
  eventType: string;
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
