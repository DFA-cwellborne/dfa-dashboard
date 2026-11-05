-- Adds columns the sync already reads from the Chapter Master List sheet but
-- previously discarded: per-chapter RSO/charter status, the staff member
-- assigned, the last logged event date, free-text chapter notes, and the
-- public Breakthru community link. See CHAPTER_MASTER_LIST_LAYOUT in
-- src/config/sheetMapping.ts for the sheet's column order.
--
-- Deliberately NOT added: president name/email/phone, or the membership-
-- sheet link — those are PII/internal and must never land in this table
-- (RLS grants public anon-key read access to everything here, same as
-- every other column already in `chapters`).
alter table chapters add column if not exists rso_status text;
alter table chapters add column if not exists charter_status text;
alter table chapters add column if not exists staff_contact text;
alter table chapters add column if not exists last_event_date date;
alter table chapters add column if not exists notes text;
alter table chapters add column if not exists link text;
