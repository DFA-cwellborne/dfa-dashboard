-- Drops columns for chapter-level metrics that had no real data source
-- (leadership depth, volunteer hours, starter kits, tabling kits). Per-chapter
-- type/state/status now come from the Chapter Master List tab instead of
-- being left null.

alter table chapters
  drop column if exists officer_count,
  drop column if exists volunteer_hours,
  drop column if exists starter_kit_distributed,
  drop column if exists tabling_kits_on_loan;

alter table chapter_snapshots
  drop column if exists officer_count;
