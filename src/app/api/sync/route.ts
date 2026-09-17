import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync/orchestrator";

// Manual "sync now" trigger, used by the admin page. Always dynamic — never
// cached — since it has side effects (writes to Supabase).
export const dynamic = "force-dynamic";

export async function POST() {
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
