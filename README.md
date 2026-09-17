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

```
Google Sheets (Home tab)  ─┐
Airtable (signups, events) ┼─> sync adapters (src/lib/sync/*) ─> Supabase
                            │                                       │
                            │                                       ├─> single overview page (src/app/page.tsx)
                            │                                       └─> realtime subscriptions (live sync-status dot)
```

The dashboard **never** queries Google Sheets/Airtable directly on page load —
the single overview page reads only from Supabase, populated by:
- The **"Sync now" button** in the on-page Admin/Sync section (`POST /api/sync`)
- A scheduled job hitting `GET /api/cron/sync` (see below)

Everything lives on one page: hero stats, chapter/RSO status, trend charts,
the signups date-range chart, program-health metrics, the chapters table, and
the admin/sync panel are all sections of `src/app/page.tsx`.

## Setup

1. `.env.local` already has your real Supabase project, Google Sheet ID,
   Airtable, and Breakthru credentials filled in.
2. **Run the migrations, in order** — copy the full contents of
   `supabase/migrations/0001_init.sql` into your Supabase project's SQL
   editor (Project → SQL Editor → New query) and run it, then do the same
   with `0002_remove_unused_chapter_fields.sql`. Don't paste the file
   *path*, paste the file's *contents*.
3. **Still needed before Sheets sync will work**: the sheet is already set
   to "anyone with the link can view," so create a plain Google API key
   (console.cloud.google.com → APIs & Services → enable "Google Sheets API"
   → Credentials → Create API Key) and set `GOOGLE_SHEETS_API_KEY` in
   `.env.local`.
4. `npm run dev`, scroll to the Admin/Sync section, click **Sync now**.
5. To test against generated sample data instead of real credentials at any
   point, set `USE_MOCK_DATA=true` — `src/lib/sync/mockAdapter.ts` mirrors
   the real Sheets/Airtable shapes (including mixed-case school names, to
   exercise the same matching logic).

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

This already runs on its own — no cron job to set up. `src/instrumentation.ts`
schedules a sync every `SYNC_INTERVAL_MINUTES` (default 20) as soon as the
server starts, as long as it's run as a long-lived process (`npm run dev`,
`npm start`, self-hosted, Docker). You'll see
`[auto-sync] synced 2 source(s) successfully` in the server logs on each run.

If you ever deploy to **Vercel** instead, that model doesn't apply
(serverless functions don't stay running for a timer) — `vercel.json` already
has a matching cron entry hitting `GET /api/cron/sync` every 20 minutes, and
`src/instrumentation.ts` detects Vercel and skips its own scheduler so the two
don't double up.

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
