import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chapter, SourceAdapter } from "@/lib/types/schema";

// ---- fakes -----------------------------------------------------------------
const h = vi.hoisted(() => ({
  db: {
    chapters: [] as { external_id: string; source: string }[],
    deleted: [] as string[],
    inserts: [] as { table: string; row: Record<string, unknown> }[],
    failUpsertOn: null as string | null,
  },
  adapters: [] as unknown[],
}));

vi.mock("@/config/env", () => ({
  env: {
    supabase: { url: "https://example.supabase.co", anonKey: "anon", serviceRoleKey: "service" },
    sync: { useMockData: false, intervalMinutes: 20, cronSecret: undefined },
  },
}));
vi.mock("./googleSheetsAdapter", () => ({ createGoogleSheetsAdapter: () => h.adapters[0] }));
vi.mock("./airtableAdapter", () => ({ createAirtableAdapter: () => h.adapters[1] }));
vi.mock("./mockAdapter", () => ({ createMockAdapter: () => h.adapters[0] }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleSupabase: () => ({
    from: (table: string) => ({
      upsert: async (rows: { external_id?: string; source?: string }[]) => {
        if (h.db.failUpsertOn === table) return { error: { message: "boom" } };
        if (table === "chapters") {
          for (const r of rows) {
            if (!h.db.chapters.some((c) => c.external_id === r.external_id)) {
              h.db.chapters.push({ external_id: r.external_id!, source: r.source! });
            }
          }
        }
        return { error: null };
      },
      insert: async (row: Record<string, unknown>) => {
        h.db.inserts.push({ table, row });
        return { error: null };
      },
      select: () => ({
        eq: async (_col: string, source: string) => ({
          data: h.db.chapters.filter((c) => c.source === source).map((c) => ({ external_id: c.external_id })),
          error: null,
        }),
      }),
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          h.db.deleted.push(...ids);
          h.db.chapters = h.db.chapters.filter((c) => !ids.includes(c.external_id));
          return { error: null };
        },
      }),
    }),
  }),
}));

import { runSync } from "./orchestrator";

const FK = "Note:\nThis is a Foreign Key to `chapters.external_id`.<fk table='chapters' column='external_id'/>";
function openapi(attached: boolean) {
  const prop = { chapter_external_id: { description: attached ? FK : "" } };
  return { definitions: { chapter_snapshots: { properties: prop }, chapter_events: { properties: prop } } };
}
const stubOpenApi = (attached: boolean) =>
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => openapi(attached) })));

const chapter = (name: string): Chapter => ({
  externalId: name.toLowerCase().replace(/\s+/g, "-"), name, schoolType: "College", status: "active", state: "TX",
  locale: null, memberCount: 1, signupDate: null, charterDate: null, term: null, source: "google_sheets",
});

function sheets(fetchChapters: SourceAdapter["fetchChapters"]): SourceAdapter {
  return { source: "google_sheets", isConfigured: () => true, fetchChapters };
}
const airtable: SourceAdapter = {
  source: "airtable", isConfigured: () => true, fetchSignups: async () => [], fetchEvents: async () => [],
};

const DB_BEFORE = [
  { external_id: "university-of-oklahoma", source: "google_sheets" },
  { external_id: "butler-university", source: "google_sheets" },
  { external_id: "nc-state", source: "google_sheets" },
  { external_id: "hand-added", source: "manual" },
];
const SHEET_NOW = async () => [chapter("University of Oklahoma"), chapter("Butler University")]; // NC State was deleted

beforeEach(() => {
  h.db.chapters = DB_BEFORE.map((c) => ({ ...c }));
  h.db.deleted = [];
  h.db.inserts = [];
  h.db.failUpsertOn = null;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("runSync — removing chapters that ceased to exist", () => {
  it("removes a chapter that was deleted from the sheet (the NC State bug)", async () => {
    stubOpenApi(false);
    h.adapters = [sheets(SHEET_NOW), airtable];

    const results = await runSync();

    expect(h.db.deleted).toEqual(["nc-state"]);
    expect(h.db.chapters.map((c) => c.external_id)).not.toContain("nc-state");
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("only ever touches rows from the source that was read — never another source's", async () => {
    stubOpenApi(false);
    h.adapters = [sheets(SHEET_NOW), airtable];
    await runSync();
    expect(h.db.chapters.map((c) => c.external_id)).toContain("hand-added");
    expect(h.db.deleted).not.toContain("hand-added");
  });

  it("keeps everything while history is still attached to chapters — deleting would cascade and erase it", async () => {
    stubOpenApi(true);
    h.adapters = [sheets(SHEET_NOW), airtable];
    const results = await runSync();
    expect(h.db.deleted).toEqual([]);
    expect(results.every((r) => r.success)).toBe(true); // routine, not a failure
  });

  it("keeps everything if it can't tell whether history is attached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    h.adapters = [sheets(SHEET_NOW), airtable];
    await runSync();
    expect(h.db.deleted).toEqual([]);
  });

  it("removes nothing when the sheet read failed — a failed read is not 'no chapters'", async () => {
    stubOpenApi(false);
    h.adapters = [sheets(async () => { throw new Error("getaddrinfo ENOTFOUND sheets.googleapis.com"); }), airtable];
    const results = await runSync();
    expect(h.db.deleted).toEqual([]);
    expect(results.find((r) => r.source === "google_sheets")!.success).toBe(false);
  });

  it("removes nothing when the sheet came back empty", async () => {
    stubOpenApi(false);
    h.adapters = [sheets(async () => []), airtable];
    await runSync();
    expect(h.db.deleted).toEqual([]);
  });

  it("refuses a mass deletion and reports it as a failure instead of silently doing it", async () => {
    stubOpenApi(false);
    h.db.chapters = ["a", "b", "c", "d", "e", "f"].map((id) => ({ external_id: id, source: "google_sheets" }));
    h.adapters = [sheets(async () => [chapter("a")]), airtable];

    const results = await runSync();

    expect(h.db.deleted).toEqual([]);
    const sheetResult = results.find((r) => r.source === "google_sheets")!;
    expect(sheetResult.success).toBe(false);
    expect(sheetResult.errors.join(" ")).toMatch(/refusing to remove 5 of 6/);
  });

  it("removes nothing if saving the fresh chapters failed", async () => {
    stubOpenApi(false);
    h.db.failUpsertOn = "chapters";
    h.adapters = [sheets(SHEET_NOW), airtable];
    const results = await runSync();
    expect(h.db.deleted).toEqual([]);
    expect(results.every((r) => !r.success)).toBe(true);
  });

  it("a source that doesn't provide chapters (Airtable) never prunes anything", async () => {
    stubOpenApi(false);
    h.adapters = [sheets(SHEET_NOW), airtable];
    await runSync({ sources: ["airtable"] });
    expect(h.db.deleted).toEqual([]);
  });

  it("still logs a sync_log row for every source", async () => {
    stubOpenApi(false);
    h.adapters = [sheets(SHEET_NOW), airtable];
    await runSync();
    expect(h.db.inserts.filter((i) => i.table === "sync_log").map((i) => i.row.source).sort()).toEqual(["airtable", "google_sheets"]);
  });
});
