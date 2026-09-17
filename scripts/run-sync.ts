// Entry point for the GitHub Actions sync cron (.github/workflows/sync.yml).
// The dashboard itself is a static export with no server, so this is what
// actually writes Google Sheets/Airtable data into Supabase.
//
// Usage: npx tsx scripts/run-sync.ts (all real source env vars must be set)
import { runSync } from "../src/lib/sync/orchestrator";

async function main() {
  const results = await runSync();
  for (const r of results) {
    console.log(
      `[${r.source}] ${r.success ? "OK" : "FAILED"} — ${r.recordsProcessed} records`,
      r.errors.length ? r.errors : ""
    );
  }
  if (results.some((r) => !r.success)) process.exit(1);
}

main();
