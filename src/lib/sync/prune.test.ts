import { describe, expect, it } from "vitest";
import { historyStillAttachedToChapters, planChapterPrune, pruneChapters, type PruneDb } from "./prune";

describe("planChapterPrune", () => {
  it("removes exactly the chapters that are no longer in the source", () => {
    expect(planChapterPrune(["a", "b", "nc"], ["a", "b"])).toEqual({ toDelete: ["nc"], blocked: null });
  });

  it("removes nothing when nothing changed, or when chapters were only added", () => {
    expect(planChapterPrune(["a", "b"], ["a", "b"]).toDelete).toEqual([]);
    expect(planChapterPrune(["a"], ["a", "b", "c"]).toDelete).toEqual([]);
  });

  it("refuses to treat an empty read as 'every chapter ceased to exist'", () => {
    const plan = planChapterPrune(["a", "b", "c"], []);
    expect(plan.toDelete).toEqual([]);
    expect(plan.blocked).toMatch(/no chapters/);
  });

  it("refuses a mass deletion — a truncated read looks exactly like one", () => {
    const existing = ["a", "b", "c", "d", "e", "f"];
    const plan = planChapterPrune(existing, ["a", "b"]); // would remove 4 of 6
    expect(plan.toDelete).toEqual([]);
    expect(plan.blocked).toMatch(/4 of 6/);
  });

  it("allows a few removals even from a small roster (real churn)", () => {
    expect(planChapterPrune(["a", "b", "c"], ["a"]).toDelete).toEqual(["b", "c"]); // 2 of 3: within the unconditional allowance
    expect(planChapterPrune(["a", "b", "c", "d", "e", "f", "g", "h"], ["a", "b", "c", "d", "e"]).blocked).toBeNull(); // 3 of 8: a minority
  });
});

describe("historyStillAttachedToChapters", () => {
  const fk = "Note:\nThis is a Foreign Key to `chapters.external_id`.<fk table='chapters' column='external_id'/>";
  const doc = (snap: string, ev: string) => ({
    definitions: {
      chapter_snapshots: { properties: { chapter_external_id: { description: snap } } },
      chapter_events: { properties: { chapter_external_id: { description: ev } } },
    },
  });

  it("is true while either history table still has a foreign key to chapters", () => {
    expect(historyStillAttachedToChapters(doc(fk, ""))).toBe(true);
    expect(historyStillAttachedToChapters(doc("", fk))).toBe(true);
    expect(historyStillAttachedToChapters(doc(fk, fk))).toBe(true);
  });

  it("is false once both are detached", () => {
    expect(historyStillAttachedToChapters(doc("", ""))).toBe(false);
  });

  it("assumes 'still attached' whenever it can't tell — the safe direction", () => {
    expect(historyStillAttachedToChapters(null)).toBe(true);
    expect(historyStillAttachedToChapters({})).toBe(true);
    expect(historyStillAttachedToChapters({ definitions: {} })).toBe(true);
    expect(historyStillAttachedToChapters("<html>gateway error</html>")).toBe(true);
  });
});

describe("pruneChapters", () => {
  function fakeDb(existing: string[]) {
    const calls = { listed: [] as string[], deleted: [] as string[][] };
    const db: PruneDb = {
      async listChapterIds(source) {
        calls.listed.push(source);
        return existing;
      },
      async deleteChapters(ids) {
        calls.deleted.push(ids);
      },
    };
    return { db, calls };
  }

  it("deletes the missing chapter when history is detached", async () => {
    const { db, calls } = fakeDb(["ou", "butler", "nc-state"]);
    const out = await pruneChapters(db, { source: "google_sheets", fetchedIds: ["ou", "butler"], historyDetached: true });
    expect(out).toEqual({ deleted: ["nc-state"], skipped: null, suspicious: false });
    expect(calls.deleted).toEqual([["nc-state"]]);
    expect(calls.listed).toEqual(["google_sheets"]);
  });

  it("does nothing — and doesn't even look — while history is still attached to chapters (deleting would cascade)", async () => {
    const { db, calls } = fakeDb(["ou", "nc-state"]);
    const out = await pruneChapters(db, { source: "google_sheets", fetchedIds: ["ou"], historyDetached: false });
    expect(out.deleted).toEqual([]);
    expect(out.skipped).toMatch(/0003/);
    expect(out.suspicious).toBe(false);
    expect(calls.deleted).toEqual([]);
    expect(calls.listed).toEqual([]);
  });

  it("flags a suspicious deletion instead of performing it", async () => {
    const { db, calls } = fakeDb(["a", "b", "c", "d", "e", "f"]);
    const out = await pruneChapters(db, { source: "google_sheets", fetchedIds: ["a"], historyDetached: true });
    expect(out.suspicious).toBe(true);
    expect(calls.deleted).toEqual([]);
  });

  it("is a quiet no-op on an empty database", async () => {
    const { db, calls } = fakeDb([]);
    const out = await pruneChapters(db, { source: "google_sheets", fetchedIds: [], historyDetached: true });
    expect(out).toEqual({ deleted: [], skipped: null, suspicious: false });
    expect(calls.deleted).toEqual([]);
  });

  it("doesn't call delete when there's nothing to delete", async () => {
    const { db, calls } = fakeDb(["a", "b"]);
    await pruneChapters(db, { source: "google_sheets", fetchedIds: ["a", "b"], historyDetached: true });
    expect(calls.deleted).toEqual([]);
  });
});
