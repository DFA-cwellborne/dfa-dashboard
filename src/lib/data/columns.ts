// The dashboard reads Supabase with the public anon key, which ships in the
// site's JavaScript — so whatever these queries return is public. Every query
// names its columns explicitly (never select("*")) so a column added to a table
// later, however sensitive, doesn't silently start flowing to every visitor.
// A test (columns.test.ts) fails if a personal-data-looking column is added here.
export const PUBLIC_COLUMNS = {
  chapters:
    "id,external_id,name,school_type,status,state,locale,member_count,signup_date,charter_date,term,source,created_at,updated_at",
  chapter_snapshots: "id,chapter_external_id,snapshot_date,status,member_count,term,created_at",
  chapter_events:
    "id,external_id,chapter_external_id,event_type,event_date,attendee_count,volunteer_hours,source,created_at",
  chapter_signups: "id,external_id,chapter_name,school_type,submitted_at,status,source,created_at",
  sheet_summary:
    "id,total_chapters,total_members,active_chapters,status_active,status_inactive,status_pending_launch,rso_recognized,rso_pending,rso_not_recognized,rso_expired,synced_at",
  sync_log: "id,source,success,started_at,finished_at,records_processed,errors,created_at",
} as const;
