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
- **Public chapter map CSV** — a *third*, separate Google Sheet (a "Public
  map" tab, published-to-web as CSV, no credentials needed) that already
  drives the live map at dreamforamerica.org/chapters/: `school, type,
  state, city, lat, lng, status, president, link`, status only ever
  `active`/`launching`. Deliberately **not merged** with the Chapter Master
  List — chapter names don't always match exactly between the two sheets
  (e.g. "Western Albemarle HS" vs "Western Albemarle High School"), so
  merging risks silently duplicating or misassigning chapters. It's richer
  and more current than the Master List (real coordinates, more chapters)
  and is the only source for the Map view and the Goals feature — the rest
  of the dashboard (member counts, RSO status, etc.) is untouched by it.
  See `src/lib/sync/publicMapAdapter.ts` / `publicMapSync.ts` and the
  `public_map_chapters` / `public_map_snapshots` tables (migration `0005`).

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
2. **Run the migrations, in order** — copy the full contents of each file in
   `supabase/migrations/` (`0001`, `0002`, `0003`) into your Supabase
   project's SQL editor (Project → SQL Editor → New query) and run it. Don't
   paste the file *path*, paste the file's *contents*. All are safe to re-run.
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

### Testing

| Command | What it does |
|---|---|
| `npm test` | Unit + component tests (vitest). Hermetic — never touches real Supabase/Sheets/Airtable. |
| `npm run lint` | ESLint. |
| `npm run check:bundle` | After `npm run build`: fails if any real secret value appears in the public `out/` export. |
| `npm run health` | Live check of the deployed system: Supabase reachable, data present, each sync source fresh and reliable, no credentials visible in the public sync log, site + assets load. |

`deploy.yml` runs lint, tests, the build, and the bundle scan before every deploy, so a
failing check leaves the currently-live site untouched.

The tests deliberately encode past bugs (dropped first chapter, missing counts treated as
zero, the API key that reached the public sync log, dashboard blanking on a failed refresh)
so they can't come back. Rule of thumb: if a bug gets fixed, add the test that would have
caught it.

### Privacy

The dashboard reads Supabase with the **public anon key**, which ships in the site's
JavaScript — so everything in the tables it reads is public. Therefore:

- The sync stores only the fields the dashboard displays. It never stores raw source rows
  (the Master List has presidents' names/emails/phones; the intake form has names, emails,
  phones and zip codes). This was once violated; `raw` columns were dropped in migration `0003`.
- Every query names its columns (`src/lib/data/columns.ts`) — never `select("*")` — so a
  column added later can't silently become public. Tests enforce both rules.
- `npm run health` reads the public tables like a stranger would and fails if any email or
  phone number is visible.

Before adding a field to the sync, ask: *would I be comfortable with this on a public web page?*

### Stats and Map views

The dashboard has two views, switched with the Stats / Map toggle under the header. The
current view lives in the URL hash (`#map`), so a refresh stays put and a link can point
straight at the map. Both views share one data load.

### Events

Events come from the chapters' Airtable *event planning* form, so an event is logged when it's
filed — before it happens. "Events Logged" therefore splits into **held** (planned date today or
earlier) and **upcoming**. Types are whatever the form's dropdown says, verbatim. Form fields are
matched by pattern (`EVENT_FIELD_ALIASES`), so rewording a question is fine as long as it starts
the same way.

### Chapters that cease to exist

When a chapter is deleted from the Master List, the next sync removes it from the dashboard
(`src/lib/sync/prune.ts`). Because a bug here would delete real data, it is deliberately cautious:
it only runs after a *successful* read, never on an empty result, refuses to remove a majority of
chapters at once (and reports that as a failed sync instead), only touches rows from the source
that was read, and only runs once migration `0003` has detached history from the chapters table —
so deleting a chapter never erases its past trend snapshots or events.

### The chapter map

The Chapter Master List tracks each chapter's **state**, not its campus, so each dot sits at
its state's center; chapters sharing a state fan out around it (stable order) instead of
stacking. Chapters with a blank/unrecognized state (territories, typos) aren't drawn but are
listed beside the map. Map shapes are `us-atlas` (pre-projected, so no runtime projection);
see `src/lib/map/`. Exact campus pins would need a geocoding step at sync time.

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

No server or long-lived process needed — `.github/workflows/sync.yml` runs
`npm run sync:run` (`scripts/run-sync.ts` → `runSync()` + `syncPublicMap()`
in parallel), using the repo secrets above, every 20 minutes.

**What actually triggers it**: not GitHub's own `schedule:` cron. That had a
documented, ongoing reliability problem (multi-hour delays instead of the
configured 20 minutes — isolated to GitHub's `schedule:` trigger-evaluation
specifically). Instead, **Supabase's own `pg_cron`** (migration
`0004_pg_cron_github_dispatch.sql`) calls GitHub's `workflow_dispatch` REST
API every 20 minutes — a different, unaffected code path. The GitHub PAT it
uses lives in Supabase Vault (`vault.decrypted_secrets`, under the hood only
reachable server-side, never via the public anon-key API), set once by hand:

```sql
select vault.create_secret('<classic PAT with the "workflow" or "repo" scope>', 'github_pat');
select vault.create_secret('https://api.github.com/repos/<owner>/<repo>/actions/workflows/sync.yml/dispatches', 'github_dispatch_url');
```

Use a **classic** PAT, not fine-grained — a fine-grained token's "Actions"
permission returned `403 Resource not accessible by personal access token`
on the `workflow_dispatch` call even with Actions set to Read and write;
a classic token with the `workflow` (or `repo`) scope worked immediately.
To rotate the token later: `select vault.update_secret((select id from vault.secrets where name = 'github_pat'), '<new token>');`

`sync.yml` keeps `workflow_dispatch: {}` as both pg_cron's entry point and a
manual-rerun escape hatch — it no longer has a `schedule:` trigger of its own.

Note: GitHub auto-disables *manually re-run* workflows only after 60 days
with no repo activity, same as before — not a concern here since pg_cron
calls it every 20 minutes regardless of repo activity.

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
