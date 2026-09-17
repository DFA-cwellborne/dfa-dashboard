# DFA Metrics Dashboard

National metrics dashboard for Dream for America chapters, built on Next.js 16
+ Supabase (Postgres + realtime) as a synced cache layer between the source
data (Google Sheets / Airtable / future Breakthru API) and the dashboard.

## What each source actually provides

This isn't three symmetric "chapter data" sources — each one models something
different, and the sync layer reflects that:

- **Google Sheets** — two tabs in the same spreadsheet. The "Home" tab is a
  rolled-up dashboard: fixed cells for headline totals (total/active
  chapters, total members) and two small label/count tables (chapter status,
  RSO status) — see `HOME_SHEET_LAYOUT` in `src/config/sheetMapping.ts`. The
  "Chapter Master List" tab is the real per-chapter table (name, HS/College,
  state, status, member count) and is what populates the chapters table's
  Type/State/Status columns — see `CHAPTER_MASTER_LIST_LAYOUT` in the same
  file. Both are read by `src/lib/sync/googleSheetsAdapter.ts`.
- **Airtable** — two unrelated bases: "start a chapter" intake signups, and
  events hosted by chapters. Neither is a chapter roster. Events reference a
  chapter by free-text school name, matched case/whitespace-insensitively
  against the Sheets roster via `slugifyName()` in `src/lib/types/schema.ts`.
- **Breakthru** — only a People API exists (list/get/update person, create a
  points transaction) — no chapters/groups endpoint. `breakthruClient.ts` has
  a real, working client for it; it isn't wired into the sync loop yet since
  there's no clear mapping from individual people to chapter-level metrics.

## Architecture

This is a **static export hosted on GitHub Pages** — there's no Node server in
production, so the two jobs that used to be "the backend" are now two GitHub
Actions workflows in `.github/workflows/`:

```
Google Sheets (Home + Master List) ─┐
Airtable (signups, events)          ┼─> sync.yml (cron, every 20 min) ─> Supabase
                                     │        runs scripts/run-sync.ts
                                     │
                                     └─> deploy.yml (on push to main)
                                              `next build` (output: "export") ─> GitHub Pages

Browser ── loads static HTML/JS from Pages ── fetches Supabase directly (anon key) ── renders
```

The dashboard **never** queries Google Sheets/Airtable directly — only the
`sync` workflow does that, server-side, using the Supabase service-role key
(kept as a GitHub Actions secret, never shipped to the browser). The deployed
page itself reads Supabase straight from the browser using the public anon
key, which is safe because reads are gated by the RLS policies in
`supabase/migrations/0001_init.sql` — see `src/components/dashboard/Overview.tsx`.

Everything lives on one page: hero stats, chapter/RSO status, trend charts,
the signups date-range chart, program-health metrics, the chapters table, and
the admin/sync panel are all sections of `src/components/dashboard/Overview.tsx`.

**Important:** `src/config/env.ts` (server secrets, via dynamic `process.env[name]`
lookups) and `src/lib/supabase/server.ts` (the service-role client) must never
be imported — even transitively — by a client component. Next's bundler
inlines the *entire* referenced env value once a dynamic lookup like that is
reachable from client code, not just `NEXT_PUBLIC_*` ones (this leaked the
service-role key into the exported JS once, during development — caught by
grepping the built `out/` bundle before it was ever deployed). Client code
must only import from `src/config/publicEnv.ts` instead.

## Setup

### Local development

1. `.env.local` already has your real Supabase project, Google Sheet ID,
   Airtable, and Breakthru credentials filled in.
2. **Run the migrations, in order** — copy the full contents of
   `supabase/migrations/0001_init.sql` into your Supabase project's SQL
   editor (Project → SQL Editor → New query) and run it, then do the same
   with `0002_remove_unused_chapter_fields.sql`. Don't paste the file
   *path*, paste the file's *contents*.
3. `npm run dev`, then `npm run sync:run` in another terminal to pull real
   data in (or `npm run seed:mock` to test with generated sample data first —
   `src/lib/sync/mockAdapter.ts` mirrors the real shapes, including
   mixed-case school names, to exercise the same matching logic).

### Deploying (GitHub Pages + Actions)

1. **Repo secrets** — Settings → Secrets and variables → Actions → New
   repository secret. Add every value from `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`,
   `GOOGLE_SHEETS_SHEET_NAME`, `GOOGLE_SHEETS_API_KEY`, `AIRTABLE_API_KEY`,
   `AIRTABLE_SIGNUPS_BASE_ID`, `AIRTABLE_SIGNUPS_TABLE`,
   `AIRTABLE_EVENTS_BASE_ID`, `AIRTABLE_EVENTS_TABLE`,
   `BREAKTHRU_API_BASE_URL`, `BREAKTHRU_API_KEY`.
2. **Pages source** — Settings → Pages → Build and deployment → Source →
   **GitHub Actions**.
3. Push to `main`. `deploy.yml` builds and publishes the site;
   `sync.yml` starts running on its own 20-minute schedule. Both can also be
   triggered manually from the repo's **Actions** tab (`workflow_dispatch`).
4. The site is served at `https://<org>.github.io/dfa-dashboard/` — that path
   is hardcoded as `basePath` in `next.config.ts` since GitHub Pages project
   sites always live under `/<repo-name>/`.

### If the sheet layout changes

Edit `HOME_SHEET_LAYOUT` or `CHAPTER_MASTER_LIST_LAYOUT` in
`src/config/sheetMapping.ts` — cell/range references for the Home tab's
totals and label/count tables, or the Master List's data range and column
order. Nothing else needs to change.

### Removed metrics (no real data source)

Leadership Depth, Volunteer Hours, Starter Kits Distributed, and Tabling
Kits On Loan were removed — nothing (Sheets, Airtable, or Breakthru) reports
per-chapter officer counts, volunteer hours, or equipment. Chapter Retention
and Avg. Time to Charter are still on the dashboard but will keep showing
"No data" until there's a real source for terms/signup+charter dates (e.g.
Calendly for signup date, Airtable for charter date).

### Airtable field names

`SIGNUP_FIELD_ALIASES` and `EVENT_FIELD_ALIASES` in `src/config/sheetMapping.ts`
list the header aliases checked for each field. If a real field name isn't
matching, add it to the relevant alias list.

### Auto-sync

Handled entirely by `.github/workflows/sync.yml` — no server or long-lived
process needed. It runs `npm run sync:run` (`scripts/run-sync.ts` →
`runSync()`) every 20 minutes via a GitHub Actions `schedule` cron, using the
repo secrets above. GitHub Actions cron jobs on public repos are free with no
frequency limit (unlike Vercel's free tier, which caps cron at once/day).

Note: GitHub auto-disables scheduled workflows after 60 days with no repo
activity — push anything, or run `sync.yml` manually once, to re-enable it if
that ever happens.

## Build order (for reference)

1. Schema + sync adapters, verified against mock data
   (`src/lib/sync/mockAdapter.ts`)
2. Sync status dot (green/red) — `src/components/ui/SyncStatusIndicator.tsx`,
   live via Supabase realtime
3. Single-page national dashboard — `src/app/page.tsx`
4. Breakthru client — real People API, not yet wired into the sync loop

## Logo

Drop the real DFA logo file in `/public` and update
`src/components/layout/LogoPlaceholder.tsx` to render it — every nav/header
already renders `<LogoPlaceholder />`, so that's the only file that needs to
change.
