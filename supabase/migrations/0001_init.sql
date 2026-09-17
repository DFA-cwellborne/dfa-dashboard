-- DFA Metrics Dashboard — core schema
-- This is the "synced cache layer" the dashboard reads from. Nothing in the
-- app queries Google Sheets/Airtable directly — sync adapters write here on
-- a schedule (see src/lib/sync/orchestrator.ts) and the dashboard reads only
-- from these tables (with realtime subscriptions layered on top).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Chapters: the roster from the Google Sheets "Chapter Master List" tab
-- (name, type, state, status, member count per row) — upserted by
-- external_id (a slug of the chapter name) on every sync. signup_date/
-- charter_date/term stay null until a source reports them.
-- ---------------------------------------------------------------------------
create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  name text not null,
  school_type text check (school_type in ('HS', 'College')),
  status text check (status in ('active', 'inactive', 'pending_launch')),
  state text,
  locale text check (locale in ('urban', 'suburban', 'rural')),
  member_count integer,
  signup_date date,
  charter_date date,
  term text,
  source text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chapters_status on chapters (status);
create index if not exists idx_chapters_school_type on chapters (school_type);
create index if not exists idx_chapters_state on chapters (state);

-- ---------------------------------------------------------------------------
-- Chapter snapshots: append-only, one row per chapter per sync run, used to
-- drive the "growth over time" trend charts.
-- ---------------------------------------------------------------------------
create table if not exists chapter_snapshots (
  id uuid primary key default gen_random_uuid(),
  chapter_external_id text not null references chapters (external_id) on delete cascade,
  snapshot_date date not null default current_date,
  status text,
  member_count integer,
  term text,
  created_at timestamptz not null default now(),
  unique (chapter_external_id, snapshot_date)
);

create index if not exists idx_snapshots_date on chapter_snapshots (snapshot_date);

-- ---------------------------------------------------------------------------
-- Events hosted by chapters (from the Airtable events base).
-- ---------------------------------------------------------------------------
create table if not exists chapter_events (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  chapter_external_id text not null references chapters (external_id) on delete cascade,
  event_type text check (
    event_type in ('voter_registration', 'tabling', 'social', 'training', 'other')
  ),
  event_date date,
  attendee_count integer,
  volunteer_hours numeric,
  source text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_chapter on chapter_events (chapter_external_id);
create index if not exists idx_events_type on chapter_events (event_type);
create index if not exists idx_events_date on chapter_events (event_date);

-- ---------------------------------------------------------------------------
-- Sheet summary: singleton row (id = 'default'), overwritten every sync,
-- holding the aggregate totals read directly off the Google Sheets Home tab
-- (total/active chapters, total members, status + RSO status breakdowns).
-- ---------------------------------------------------------------------------
create table if not exists sheet_summary (
  id text primary key,
  total_chapters integer,
  total_members integer,
  active_chapters integer,
  status_active integer,
  status_inactive integer,
  status_pending_launch integer,
  rso_recognized integer,
  rso_pending integer,
  rso_not_recognized integer,
  rso_expired integer,
  synced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chapter signups: "start a chapter" intake submissions from Airtable.
-- ---------------------------------------------------------------------------
create table if not exists chapter_signups (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  chapter_name text,
  school_type text check (school_type in ('HS', 'College')),
  submitted_at date,
  status text,
  source text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_signups_submitted_at on chapter_signups (submitted_at);

-- ---------------------------------------------------------------------------
-- Sync log: powers the admin/sync section (last sync time per source, errors, etc.)
-- ---------------------------------------------------------------------------
create table if not exists sync_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  success boolean not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  records_processed integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_synclog_source on sync_log (source, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for chapters
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_chapters_updated_at on chapters;
create trigger trg_chapters_updated_at
  before update on chapters
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime: enable so the dashboard can subscribe to live changes once the
-- sync layer starts populating these tables.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table chapters;
alter publication supabase_realtime add table chapter_snapshots;
alter publication supabase_realtime add table chapter_events;
alter publication supabase_realtime add table sheet_summary;
alter publication supabase_realtime add table chapter_signups;
alter publication supabase_realtime add table sync_log;

-- ---------------------------------------------------------------------------
-- Row Level Security: dashboard reads are public-read (internal tool sitting
-- behind your own auth/network boundary); writes only via service role key
-- (used server-side by the sync orchestrator, never exposed to the browser).
-- ---------------------------------------------------------------------------
alter table chapters enable row level security;
alter table chapter_snapshots enable row level security;
alter table chapter_events enable row level security;
alter table sheet_summary enable row level security;
alter table chapter_signups enable row level security;
alter table sync_log enable row level security;

drop policy if exists "public read chapters" on chapters;
create policy "public read chapters" on chapters for select using (true);

drop policy if exists "public read chapter_snapshots" on chapter_snapshots;
create policy "public read chapter_snapshots" on chapter_snapshots for select using (true);

drop policy if exists "public read chapter_events" on chapter_events;
create policy "public read chapter_events" on chapter_events for select using (true);

drop policy if exists "public read sheet_summary" on sheet_summary;
create policy "public read sheet_summary" on sheet_summary for select using (true);

drop policy if exists "public read chapter_signups" on chapter_signups;
create policy "public read chapter_signups" on chapter_signups for select using (true);

drop policy if exists "public read sync_log" on sync_log;
create policy "public read sync_log" on sync_log for select using (true);

-- ---------------------------------------------------------------------------
-- Table-level grants: RLS policies control which *rows* a role can see, but
-- Postgres also requires the role to have SELECT on the table itself. Most
-- Supabase projects set this up as a schema-wide default already, but grant
-- it explicitly here so this migration works regardless of that.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on chapters, chapter_snapshots, chapter_events, sheet_summary, chapter_signups, sync_log
  to anon, authenticated;

grant all on chapters, chapter_snapshots, chapter_events, sheet_summary, chapter_signups, sync_log
  to service_role;
