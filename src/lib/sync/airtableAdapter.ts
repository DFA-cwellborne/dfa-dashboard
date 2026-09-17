import Airtable from "airtable";
import { env } from "@/config/env";
import type { SourceAdapter } from "@/lib/types/schema";
import { normalizeEventRow, normalizeSignupRow } from "./normalize";

/**
 * Airtable holds two unrelated things, in two separate bases:
 *  - "start a chapter" intake signups (people who filled out the website form)
 *  - events hosted by chapters
 * Neither of these is a chapter roster — that only lives in Google Sheets —
 * so this adapter does NOT implement fetchChapters().
 */
async function fetchAllRecords(
  apiKey: string,
  baseId: string,
  tableName: string
): Promise<Record<string, unknown>[]> {
  const base = new Airtable({ apiKey }).base(baseId);
  const records: Record<string, unknown>[] = [];
  await base(tableName)
    .select({ pageSize: 100 })
    .eachPage((pageRecords, fetchNextPage) => {
      for (const record of pageRecords) {
        // Airtable's REST response includes createdTime at the top level,
        // but the SDK only exposes .fields — reach into the raw response for it.
        const raw = record as unknown as { _rawJson?: { createdTime?: string } };
        records.push({
          "Record ID": record.id,
          "Created Time": raw._rawJson?.createdTime,
          ...record.fields,
        });
      }
      fetchNextPage();
    });
  return records;
}

export function createAirtableAdapter(): SourceAdapter {
  return {
    source: "airtable",
    isConfigured: () =>
      Boolean(
        env.airtable.apiKey &&
          ((env.airtable.signupsBaseId && env.airtable.signupsTable) ||
            (env.airtable.eventsBaseId && env.airtable.eventsTable))
      ),
    async fetchSignups() {
      if (!env.airtable.apiKey || !env.airtable.signupsBaseId) return [];
      const rows = await fetchAllRecords(
        env.airtable.apiKey,
        env.airtable.signupsBaseId,
        env.airtable.signupsTable
      );
      return rows
        .map((r) => normalizeSignupRow(r, "airtable"))
        .filter((s): s is NonNullable<typeof s> => s !== null);
    },
    async fetchEvents() {
      if (!env.airtable.apiKey || !env.airtable.eventsBaseId) return [];
      const rows = await fetchAllRecords(
        env.airtable.apiKey,
        env.airtable.eventsBaseId,
        env.airtable.eventsTable
      );
      return rows
        .map((r) => normalizeEventRow(r, "airtable"))
        .filter((e): e is NonNullable<typeof e> => e !== null);
    },
  };
}
