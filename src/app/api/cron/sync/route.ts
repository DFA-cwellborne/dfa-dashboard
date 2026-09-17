import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { runSync } from "@/lib/sync/orchestrator";

// Scheduled sync endpoint. Point an external scheduler (Vercel Cron, a
// GitHub Actions cron job, etc.) at this route every SYNC_INTERVAL_MINUTES
// (default 20) with header `Authorization: Bearer <SYNC_CRON_SECRET>`.
//
// Example vercel.json:
// { "crons": [{ "path": "/api/cron/sync", "schedule": "*/20 * * * *" }] }
// (Vercel Cron sends its own auth automatically when this route checks
// `x-vercel-cron`; the bearer-secret check below covers any other scheduler.)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const authHeader = request.headers.get("authorization");
  const expected = env.sync.cronSecret ? `Bearer ${env.sync.cronSecret}` : null;

  if (!isVercelCron && expected && authHeader !== expected) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runSync();
    const success = results.every((r) => r.success);
    return NextResponse.json({ success, results }, { status: success ? 200 : 207 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
