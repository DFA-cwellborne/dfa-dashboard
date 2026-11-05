-- 0005: a new, independent table sourced from the public "Chapter Map" Google
-- Sheet that already powers the live map at dreamforamerica.org/chapters/ —
-- published-to-web as CSV, no credentials needed to read it. Deliberately
-- NOT merged with `chapters` (sourced from the separate "Chapter Master
-- List" sheet): chapter names don't always match exactly between the two
-- sheets (e.g. "Western Albemarle HS" vs "Western Albemarle High School"),
-- so merging risks silently duplicating or misassigning chapters. This
-- table only ever reflects that one sheet, 1:1, by its own slugified school
-- name — same `external_id` convention as `chapters.external_id`, but a
-- disjoint id space (never compared against `chapters` rows).
create table if not exists public_map_chapters (
  external_id text primary key,
  school text not null,
  type text,
  state text,
  city text,
  lat numeric,
  lng numeric,
  status text not null check (status in ('active', 'launching')),
  president text,
  link text,
  source text not null default 'public_map',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_map_chapters_status on public_map_chapters (status);

drop trigger if exists trg_public_map_chapters_updated_at on public_map_chapters;
create trigger trg_public_map_chapters_updated_at
  before update on public_map_chapters
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Daily snapshot of the active+launching count, for the goals trend line —
-- same append-only pattern as chapter_snapshots.
-- ---------------------------------------------------------------------------
create table if not exists public_map_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  active_count integer not null,
  launching_count integer not null,
  created_at timestamptz not null default now(),
  unique (snapshot_date)
);

alter publication supabase_realtime add table public_map_chapters;
alter publication supabase_realtime add table public_map_snapshots;

alter table public_map_chapters enable row level security;
alter table public_map_snapshots enable row level security;

drop policy if exists "public read public_map_chapters" on public_map_chapters;
create policy "public read public_map_chapters" on public_map_chapters for select using (true);

drop policy if exists "public read public_map_snapshots" on public_map_snapshots;
create policy "public read public_map_snapshots" on public_map_snapshots for select using (true);

grant select on public_map_chapters, public_map_snapshots to anon, authenticated;
grant all on public_map_chapters, public_map_snapshots to service_role;
