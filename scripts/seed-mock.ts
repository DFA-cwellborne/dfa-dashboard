// Runs the sync orchestrator once, forcing mock data, so you can verify the
// mapping layer + Supabase schema end-to-end before wiring up real
// credentials. Requires Supabase env vars to be set (the mock adapter still
// needs somewhere to write).
//
// Usage: npx tsx scripts/seed-mock.ts
process.env.USE_MOCK_DATA = "true";

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
