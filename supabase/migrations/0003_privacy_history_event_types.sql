-- 0003: privacy, history that outlives chapters, and free-text event types.
-- Safe to run more than once.

-- 1. Personal data ---------------------------------------------------------
-- `raw` held every source row verbatim (names, emails, phone numbers) in tables
-- the public site can read. Nothing reads it, and the sync no longer writes it.
alter table chapters drop column if exists raw;
alter table chapter_signups drop column if exists raw;
alter table chapter_events drop column if exists raw;

-- 2. History outlives chapters ---------------------------------------------
-- chapter_snapshots (trend history) and chapter_events were tied to chapters
-- with ON DELETE CASCADE, so removing a chapter that ceased to exist would also
-- erase its past snapshots and events. It would also make one event filed with
-- an unrecognized school name fail the whole events sync. Drop every foreign key
-- that points at chapters (names are auto-generated, so find them).
do $$
declare r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where contype = 'f' and confrelid = 'public.chapters'::regclass
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- 3. Event types come from the form ----------------------------------------
-- The events form's dropdown decides the types; a fixed list here just rejects
-- any option it didn't anticipate.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.chapter_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%event_type%'
  loop
    execute format('alter table chapter_events drop constraint %I', r.conname);
  end loop;
end $$;

-- Make the API pick up the new shape immediately.
notify pgrst, 'reload schema';
