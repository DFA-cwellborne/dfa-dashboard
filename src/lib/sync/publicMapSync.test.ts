import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: {
    chapters: [] as { external_id: string }[],
    deleted: [] as string[],
    upserted: [] as Record<string, unknown>[][],
    snapshots: [] as Record<string, unknown>[],
    syncLog: [] as Record<string, unknown>[],
    failUpsert: false,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleSupabase: () => ({
    from: (table: string) => ({
      upsert: async (rows: { external_id?: string }[]) => {
        if (table === "public_map_chapters") {
          if (h.db.failUpsert) return { error: { message: "boom" } };
          h.db.upserted.push(rows);
          for (const r of rows) {
            if (!h.db.chapters.some((c) => c.external_id === r.external_id)) {
              h.db.chapters.push({ external_id: r.external_id! });
            }
          }
          return { error: null };
        }
        if (table === "public_map_snapshots") {
          h.db.snapshots.push(rows as unknown as Record<string, unknown>);
          return { error: null };
        }
        return { error: null };
      },
      // The real client's `.select()` with no further chain is itself a thenable — just return a Promise.
      select: () => Promise.resolve({ data: h.db.chapters, error: null }),
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          h.db.deleted.push(...ids);
          h.db.chapters = h.db.chapters.filter((c) => !ids.includes(c.external_id));
          return { error: null };
        },
      }),
      insert: async (row: Record<string, unknown>) => {
        h.db.syncLog.push(row);
        return { error: null };
      },
    }),
  }),
}));

import { syncPublicMap } from "./publicMapSync";

const CSV = `school,type,state,city,lat,lng,status,president,link
University of Oklahoma,College,OK,Norman,35.1987162,-97.4448963,active,Lance L.,https://community.dreamforamerica.breakthruapp.com/dfa-ou
Point Park University,,PA,Pittsburgh,40.4384916,-80.0017987,launching,,`;

function mockFetch(body: string | null, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, text: async () => body ?? "" }))
  );
}

beforeEach(() => {
  h.db.chapters = [];
  h.db.deleted = [];
  h.db.upserted = [];
  h.db.snapshots = [];
  h.db.syncLog = [];
  h.db.failUpsert = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("syncPublicMap", () => {
  it("upserts every valid row from the CSV and records a snapshot of the active/launching counts", async () => {
    mockFetch(CSV);
    const result = await syncPublicMap();

    expect(result.success).toBe(true);
    expect(result.source).toBe("public_map");
    expect(result.recordsProcessed).toBe(2);
    expect(h.db.chapters.map((c) => c.external_id).sort()).toEqual(["point-park-university", "university-of-oklahoma"]);
    expect(h.db.snapshots).toEqual([{ snapshot_date: expect.any(String), active_count: 1, launching_count: 1 }]);
  });

  it("removes a chapter no longer in the CSV", async () => {
    h.db.chapters = [{ external_id: "university-of-oklahoma" }, { external_id: "a-school-that-closed" }];
    mockFetch(CSV);
    const result = await syncPublicMap();

    expect(result.success).toBe(true);
    expect(h.db.deleted).toEqual(["a-school-that-closed"]);
  });

  it("fails without touching the table when the CSV fetch itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const result = await syncPublicMap();

    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/network down/);
    expect(h.db.upserted).toEqual([]);
  });

  it("fails without touching the table when the CSV comes back with an HTTP error", async () => {
    mockFetch(null, false);
    const result = await syncPublicMap();
    expect(result.success).toBe(false);
    expect(h.db.upserted).toEqual([]);
  });

  it("refuses to wipe the table when the CSV parses to zero usable rows — a blip, not real data", async () => {
    mockFetch("school,type,state,city,lat,lng,status,president,link\n");
    const result = await syncPublicMap();

    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/no usable rows/);
    expect(h.db.upserted).toEqual([]);
    expect(h.db.deleted).toEqual([]);
  });

  it("refuses a mass deletion instead of performing it, and reports it as a failure", async () => {
    // 6 existing chapters, CSV only has 2 of them -> 4 of 6 would be removed in one sync.
    h.db.chapters = ["university-of-oklahoma", "point-park-university", "a", "b", "c", "d"].map((external_id) => ({
      external_id,
    }));
    mockFetch(CSV);
    const result = await syncPublicMap();

    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toMatch(/refusing to remove 4 of 6/);
    expect(h.db.deleted).toEqual([]);
    // The real/current chapters still got upserted — only the deletion is held back.
    expect(h.db.chapters.map((c) => c.external_id)).toContain("university-of-oklahoma");
  });

  it("fails and leaves existing rows alone if the upsert itself fails", async () => {
    h.db.failUpsert = true;
    mockFetch(CSV);
    const result = await syncPublicMap();
    expect(result.success).toBe(false);
    expect(h.db.deleted).toEqual([]);
  });

  it("always logs a sync_log row, success or failure", async () => {
    mockFetch(CSV);
    await syncPublicMap();
    expect(h.db.syncLog).toHaveLength(1);
    expect(h.db.syncLog[0]).toMatchObject({ source: "public_map", success: true });

    h.db.syncLog = [];
    mockFetch(null, false);
    await syncPublicMap();
    expect(h.db.syncLog[0]).toMatchObject({ source: "public_map", success: false });
  });
});
