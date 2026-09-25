// A sync that only ever adds and updates leaves a chapter on the dashboard
// forever after it's deleted from the sheet. Pruning fixes that — but a bug
// here would delete real data, so it's deliberately paranoid:
//   - only after a *successful* read of the source (never on a failed fetch)
//   - never when the source returned zero chapters (an empty read is far more
//     likely a broken read than "every chapter ceased to exist")
//   - never a mass deletion (a truncated read looks exactly like one)
//   - only rows that came from that same source
//   - only once history no longer depends on the chapter row (see below)

/** A few removals at a time is normal churn; more than this needs to also be a minority of the roster. */
export const MAX_UNCONDITIONAL_DELETES = 2;

export interface PrunePlan {
  toDelete: string[];
  /** Set when the deletion looks wrong enough that we refuse and report it instead. */
  blocked: string | null;
}

export function planChapterPrune(existingIds: string[], fetchedIds: string[]): PrunePlan {
  if (fetchedIds.length === 0) {
    return { toDelete: [], blocked: "the source returned no chapters, so nothing was removed (refusing to treat an empty read as 'all chapters are gone')" };
  }

  const keep = new Set(fetchedIds);
  const toDelete = existingIds.filter((id) => !keep.has(id));

  if (toDelete.length > MAX_UNCONDITIONAL_DELETES && toDelete.length > existingIds.length / 2) {
    return {
      toDelete: [],
      blocked: `refusing to remove ${toDelete.length} of ${existingIds.length} chapters in one sync — that looks like a truncated read, not real deletions`,
    };
  }
  return { toDelete, blocked: null };
}

/**
 * chapter_snapshots (trend history) and chapter_events used to be tied to the
 * chapters table with ON DELETE CASCADE, so deleting a chapter would also erase
 * its history and its events. supabase/migrations/0003 detaches them. Until
 * that's applied, pruning would destroy history, so it doesn't run.
 *
 * PostgREST's OpenAPI document marks a column with a foreign key as
 * "This is a Foreign Key to `chapters.external_id`.<fk table='chapters' .../>".
 * If the document isn't shaped as expected we can't tell — and "can't tell"
 * must mean "assume it's still attached".
 */
export function historyStillAttachedToChapters(openapi: unknown, tables: string[] = ["chapter_snapshots", "chapter_events"]): boolean {
  const definitions = (openapi as { definitions?: Record<string, { properties?: Record<string, { description?: string }> }> })?.definitions;
  if (!definitions || typeof definitions !== "object") return true;

  return tables.some((table) => {
    const props = definitions[table]?.properties;
    if (!props) return true; // table missing from the document: can't verify
    return Object.values(props).some((p) => /<fk table='chapters'/.test(p?.description ?? ""));
  });
}

export interface PruneDb {
  listChapterIds(source: string): Promise<string[]>;
  deleteChapters(ids: string[]): Promise<void>;
}

export interface PruneOutcome {
  deleted: string[];
  /** Why nothing (or not everything) was removed, if that was deliberate. */
  skipped: string | null;
  /** True when the skip is a warning worth failing the sync over (suspicious data), not routine. */
  suspicious: boolean;
}

export async function pruneChapters(
  db: PruneDb,
  opts: { source: string; fetchedIds: string[]; historyDetached: boolean }
): Promise<PruneOutcome> {
  if (!opts.historyDetached) {
    return {
      deleted: [],
      skipped: "history still references chapters — apply supabase/migrations/0003 before removed chapters can be pruned",
      suspicious: false,
    };
  }

  const existing = await db.listChapterIds(opts.source);
  if (existing.length === 0) return { deleted: [], skipped: null, suspicious: false }; // nothing to prune
  const plan = planChapterPrune(existing, opts.fetchedIds);
  if (plan.blocked) return { deleted: [], skipped: plan.blocked, suspicious: true };

  if (plan.toDelete.length) await db.deleteChapters(plan.toDelete);
  return { deleted: plan.toDelete, skipped: null, suspicious: false };
}
