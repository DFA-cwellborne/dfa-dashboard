// Entry point for the GitHub Actions sync cron (.github/workflows/sync.yml).
// The dashboard itself is a static export with no server, so this is what
// actually writes Google Sheets/Airtable/public-map data into Supabase.
//
// Usage: npx tsx scripts/run-sync.ts (all real source env vars must be set)
import { runSync } from "../src/lib/sync/orchestrator";
import { syncPublicMap } from "../src/lib/sync/publicMapSync";

async function main() {
  // Independent of runSync()'s Chapter Master List pipeline on purpose (see
  // 0005_public_map_chapters.sql) — one failing doesn't block the other.
  const [chapterResults, publicMapResult] = await Promise.all([runSync(), syncPublicMap()]);
  const results = [...chapterResults, publicMapResult];

  for (const r of results) {
    console.log(
      `[${r.source}] ${r.success ? "OK" : "FAILED"} — ${r.recordsProcessed} records`,
      r.errors.length ? r.errors : ""
    );
  }
  if (results.some((r) => !r.success)) process.exit(1);
}

main();
