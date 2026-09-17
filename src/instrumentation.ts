// Runs once when the Next.js server starts (see
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// This is what makes auto-sync work when this app is run as a long-lived
// process (`npm run dev` / `npm start`, or self-hosted/Docker). On Vercel,
// serverless functions don't stay alive for setInterval to matter — use the
// cron config in vercel.json there instead, which this skips in favor of.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL) return;

  const { env } = await import("@/config/env");
  const { runSync } = await import("@/lib/sync/orchestrator");

  // `next dev` can re-run this module without a fresh process; guard against
  // stacking multiple intervals on top of each other.
  const g = globalThis as unknown as { __dfaAutoSyncStarted?: boolean };
  if (g.__dfaAutoSyncStarted) return;
  g.__dfaAutoSyncStarted = true;

  const intervalMs = Math.max(env.sync.intervalMinutes, 1) * 60 * 1000;

  const tick = async () => {
    try {
      const results = await runSync();
      const failed = results.filter((r) => !r.success);
      if (failed.length) {
        console.error("[auto-sync] completed with errors:", failed);
      } else {
        console.log(`[auto-sync] synced ${results.length} source(s) successfully`);
      }
    } catch (e) {
      console.error("[auto-sync] failed:", e);
    }
  };

  // First run shortly after boot (let the server finish starting up), then
  // repeat on the configured interval (SYNC_INTERVAL_MINUTES, default 20).
  setTimeout(tick, 5_000);
  setInterval(tick, intervalMs);

  console.log(`[auto-sync] scheduled every ${env.sync.intervalMinutes} minute(s)`);
}
