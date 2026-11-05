import { getServiceRoleSupabase } from "@/lib/supabase/server";
import type { PublicMapChapter, SyncResult } from "@/lib/types/schema";
import { fetchPublicMapChapters } from "./publicMapAdapter";
import { logSyncResult } from "./orchestrator";
import { planChapterPrune } from "./prune";
import { redactSecrets } from "./redact";

function errMsg(e: unknown): string {
  return redactSecrets(e instanceof Error ? e.message : String(e));
}

/**
 * Syncs the public chapter-map CSV into `public_map_chapters` — independent
 * of runSync()/orchestrator.ts's Chapter Master List pipeline on purpose
 * (see the migration comment in 0005_public_map_chapters.sql for why the two
 * are kept separate). Unlike the chapters table, nothing has a foreign key
 * into this one, so there's no "history still attached" gate before pruning
 * — only the two safety rules planChapterPrune already enforces (never wipe
 * on an empty read, never remove a majority of rows in one sync).
 */
export async function syncPublicMap(): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let chapters: PublicMapChapter[] = [];

  try {
    chapters = await fetchPublicMapChapters();
    if (chapters.length === 0) {
      errors.push("public map CSV returned no usable rows — refusing to treat that as \"no chapters\" and wipe the table");
    }
  } catch (e) {
    errors.push(`fetchPublicMapChapters: ${errMsg(e)}`);
  }

  if (errors.length === 0) {
    try {
      const supabase = getServiceRoleSupabase();

      const rows = chapters.map((c) => ({
        external_id: c.externalId,
        school: c.school,
        type: c.type,
        state: c.state,
        city: c.city,
        lat: c.lat,
        lng: c.lng,
        status: c.status,
        president: c.president,
        link: c.link,
        source: c.source,
      }));
      const { error: upsertError } = await supabase.from("public_map_chapters").upsert(rows, { onConflict: "external_id" });
      if (upsertError) throw new Error(`public_map_chapters upsert failed: ${upsertError.message}`);

      const { data: existing, error: listError } = await supabase.from("public_map_chapters").select("external_id");
      if (listError) throw new Error(`listing public_map_chapters failed: ${listError.message}`);
      const plan = planChapterPrune((existing ?? []).map((r) => r.external_id), chapters.map((c) => c.externalId));
      if (plan.blocked) {
        errors.push(`public_map_chapters prune skipped: ${plan.blocked}`);
      } else if (plan.toDelete.length) {
        const { error: deleteError } = await supabase.from("public_map_chapters").delete().in("external_id", plan.toDelete);
        if (deleteError) throw new Error(`removing stale public_map_chapters rows failed: ${deleteError.message}`);
      }

      const activeCount = chapters.filter((c) => c.status === "active").length;
      const launchingCount = chapters.filter((c) => c.status === "launching").length;
      const { error: snapshotError } = await supabase.from("public_map_snapshots").upsert(
        {
          snapshot_date: new Date().toISOString().slice(0, 10),
          active_count: activeCount,
          launching_count: launchingCount,
        },
        { onConflict: "snapshot_date" }
      );
      if (snapshotError) throw new Error(`public_map_snapshots upsert failed: ${snapshotError.message}`);
    } catch (e) {
      errors.push(errMsg(e));
    }
  }

  const result: SyncResult = {
    source: "public_map",
    success: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    recordsProcessed: chapters.length,
    errors,
  };

  await logSyncResult(result);
  return result;
}
