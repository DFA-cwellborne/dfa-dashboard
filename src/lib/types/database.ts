// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Once you have a real Supabase project, you can replace this with output
// from `supabase gen types typescript` — the shapes below match that schema
// so the swap is a drop-in.

export type ChapterRow = {
  id: string;
  external_id: string;
  name: string;
  school_type: "HS" | "College" | null;
  status: "active" | "inactive" | "pending_launch" | null;
  state: string | null;
  locale: "urban" | "suburban" | "rural" | null;
  member_count: number | null;
  signup_date: string | null;
  charter_date: string | null;
  term: string | null;
  source: string;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ChapterSnapshotRow = {
  id: string;
  chapter_external_id: string;
  snapshot_date: string;
  status: string | null;
  member_count: number | null;
  term: string | null;
  created_at: string;
}

export type ChapterEventRow = {
  id: string;
  external_id: string;
  chapter_external_id: string;
  event_type: "voter_registration" | "tabling" | "social" | "training" | "other" | null;
  event_date: string | null;
  attendee_count: number | null;
  volunteer_hours: number | null;
  source: string;
  raw: Record<string, unknown>;
  created_at: string;
}

export type SheetSummaryRow = {
  id: string;
  total_chapters: number | null;
  total_members: number | null;
  active_chapters: number | null;
  status_active: number | null;
  status_inactive: number | null;
  status_pending_launch: number | null;
  rso_recognized: number | null;
  rso_pending: number | null;
  rso_not_recognized: number | null;
  rso_expired: number | null;
  synced_at: string;
}

export type ChapterSignupRow = {
  id: string;
  external_id: string;
  chapter_name: string | null;
  school_type: "HS" | "College" | null;
  submitted_at: string | null;
  status: string | null;
  source: string;
  raw: Record<string, unknown>;
  created_at: string;
}

export type SyncLogRow = {
  id: string;
  source: string;
  success: boolean;
  started_at: string;
  finished_at: string;
  records_processed: number;
  errors: string[];
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      chapters: {
        Row: ChapterRow;
        Insert: Partial<ChapterRow>;
        Update: Partial<ChapterRow>;
        Relationships: never[];
      };
      chapter_snapshots: {
        Row: ChapterSnapshotRow;
        Insert: Partial<ChapterSnapshotRow>;
        Update: Partial<ChapterSnapshotRow>;
        Relationships: never[];
      };
      chapter_events: {
        Row: ChapterEventRow;
        Insert: Partial<ChapterEventRow>;
        Update: Partial<ChapterEventRow>;
        Relationships: never[];
      };
      sync_log: {
        Row: SyncLogRow;
        Insert: Partial<SyncLogRow>;
        Update: Partial<SyncLogRow>;
        Relationships: never[];
      };
      sheet_summary: {
        Row: SheetSummaryRow;
        Insert: Partial<SheetSummaryRow>;
        Update: Partial<SheetSummaryRow>;
        Relationships: never[];
      };
      chapter_signups: {
        Row: ChapterSignupRow;
        Insert: Partial<ChapterSignupRow>;
        Update: Partial<ChapterSignupRow>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
