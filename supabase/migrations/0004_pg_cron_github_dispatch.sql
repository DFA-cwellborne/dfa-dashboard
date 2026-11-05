-- 0004: move sync scheduling off GitHub's `schedule:` trigger (which has had
-- a documented, ongoing reliability problem — multi-hour delays instead of
-- the configured 20 minutes) onto Supabase's own pg_cron. pg_cron calls
-- GitHub's `workflow_dispatch` REST API every 20 minutes instead — a
-- different code path that GitHub's own community reports confirm stays
-- reliable through the `schedule:` outage. The sync *logic* is unchanged:
-- this only changes who presses the button, not what runs.
--
-- Safe to re-run. Requires a one-time manual step after this runs once (see
-- README.md "Auto-sync") — vault.create_secret() for the GitHub PAT and the
-- dispatch URL, done by hand in the SQL editor, never committed to git.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- supabase_vault ships enabled on current Supabase projects. If
-- vault.create_secret() ever errors with "schema vault does not exist",
-- enable it once via Database -> Extensions in the dashboard (fallback only).

select cron.unschedule('trigger-sync-workflow')
where exists (select 1 from cron.job where jobname = 'trigger-sync-workflow');

select cron.schedule(
  'trigger-sync-workflow',
  '*/20 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_url'),
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_pat'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      -- GitHub's API 403s a request with no User-Agent.
      'User-Agent', 'dfa-dashboard-pg-cron'
    ),
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);
