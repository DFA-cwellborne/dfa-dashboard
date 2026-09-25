import { google } from "googleapis";
import { env } from "@/config/env";
import {
  CHAPTER_MASTER_LIST_LAYOUT,
  HOME_SHEET_LAYOUT,
  RSO_LABEL_MAP,
  STATUS_LABEL_MAP,
} from "@/config/sheetMapping";
import type { Chapter, SheetSummary, SourceAdapter } from "@/lib/types/schema";
import { chapterFromMasterListRow } from "./normalize";

/**
 * Reads the DFA chapter "Home" dashboard sheet. Unlike a normal data table,
 * this sheet is a rolled-up view: fixed cells for headline totals, two
 * small label/count tables (status + RSO status breakdowns), and a simple
 * name+members roster below that — see HOME_SHEET_LAYOUT in
 * src/config/sheetMapping.ts for exactly which cells/ranges. Update that
 * config, not this file, if the sheet layout changes.
 *
 * Auth: either a service account (GOOGLE_SERVICE_ACCOUNT_EMAIL/_PRIVATE_KEY,
 * required for a private sheet — share the sheet with that email) or, for a
 * sheet set to "Anyone with the link can view", a plain GOOGLE_SHEETS_API_KEY.
 */
function getAuthedSheetsClient() {
  const { serviceAccountEmail, serviceAccountPrivateKey, apiKey } = env.googleSheets;

  if (serviceAccountEmail && serviceAccountPrivateKey) {
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: serviceAccountPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth });
  }

  if (apiKey) {
    return google.sheets({ version: "v4", auth: apiKey });
  }

  throw new Error(
    "Google Sheets is not configured — set a service account (GOOGLE_SERVICE_ACCOUNT_EMAIL/_PRIVATE_KEY) or GOOGLE_SHEETS_API_KEY."
  );
}

async function fetchHomeRanges() {
  const sheets = getAuthedSheetsClient();
  const spreadsheetId = env.googleSheets.spreadsheetId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not set.");
  const tab = env.googleSheets.sheetName;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      `${tab}!${HOME_SHEET_LAYOUT.totalChaptersCell}`,
      `${tab}!${HOME_SHEET_LAYOUT.totalMembersCell}`,
      `${tab}!${HOME_SHEET_LAYOUT.activeChaptersCell}`,
      `${tab}!${HOME_SHEET_LAYOUT.statusTableRange}`,
      `${tab}!${HOME_SHEET_LAYOUT.rsoTableRange}`,
      `'${CHAPTER_MASTER_LIST_LAYOUT.sheetName}'!${CHAPTER_MASTER_LIST_LAYOUT.dataRange}`,
    ],
  });

  const [totalChaptersRes, totalMembersRes, activeChaptersRes, statusRes, rsoRes, masterListRes] =
    res.data.valueRanges ?? [];

  return {
    totalChapters: totalChaptersRes?.values?.[0]?.[0],
    totalMembers: totalMembersRes?.values?.[0]?.[0],
    activeChapters: activeChaptersRes?.values?.[0]?.[0],
    statusRows: statusRes?.values ?? [],
    rsoRows: rsoRes?.values ?? [],
    masterListRows: masterListRes?.values ?? [],
  };
}

function toNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Reads label/count row pairs until the first row with a blank label. */
function parseLabelCountRows(rows: unknown[][]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const row of rows) {
    const label = String(row?.[0] ?? "").trim();
    if (!label) break;
    out.set(label.toLowerCase(), toNumberOrNull(row?.[1]));
  }
  return out;
}

export function parseHomeSheet(data: Awaited<ReturnType<typeof fetchHomeRanges>>): {
  summary: SheetSummary;
  chapters: Chapter[];
} {
  const statusCounts = parseLabelCountRows(data.statusRows);
  const rsoCounts = parseLabelCountRows(data.rsoRows);

  const findByMap = <K extends string>(
    counts: Map<string, number | null>,
    map: Record<string, K>,
    key: K
  ): number | null => {
    for (const [label, mappedKey] of Object.entries(map)) {
      if (mappedKey === key && counts.has(label)) return counts.get(label) ?? null;
    }
    return null;
  };

  const summary: SheetSummary = {
    totalChapters: toNumberOrNull(data.totalChapters),
    totalMembers: toNumberOrNull(data.totalMembers),
    activeChapters: toNumberOrNull(data.activeChapters),
    statusCounts: {
      active: findByMap(statusCounts, STATUS_LABEL_MAP, "active"),
      inactive: findByMap(statusCounts, STATUS_LABEL_MAP, "inactive"),
      pendingLaunch: findByMap(statusCounts, STATUS_LABEL_MAP, "pendingLaunch"),
    },
    rsoCounts: {
      recognized: findByMap(rsoCounts, RSO_LABEL_MAP, "recognized"),
      pending: findByMap(rsoCounts, RSO_LABEL_MAP, "pending"),
      notRecognized: findByMap(rsoCounts, RSO_LABEL_MAP, "notRecognized"),
      expired: findByMap(rsoCounts, RSO_LABEL_MAP, "expired"),
    },
    source: "google_sheets",
  };

  const chapters: Chapter[] = [];
  // First row of the range is the header row — skip it. The row after that
  // is a "[SCHOOL]" template row, filtered out inside chapterFromMasterListRow.
  for (const row of data.masterListRows.slice(1)) {
    const chapter = chapterFromMasterListRow(row ?? []);
    if (chapter) chapters.push(chapter);
  }

  return { summary, chapters };
}

export function createGoogleSheetsAdapter(): SourceAdapter {
  return {
    source: "google_sheets",
    isConfigured: () =>
      Boolean(
        env.googleSheets.spreadsheetId &&
          ((env.googleSheets.serviceAccountEmail && env.googleSheets.serviceAccountPrivateKey) ||
            env.googleSheets.apiKey)
      ),
    async fetchChapters() {
      const data = await fetchHomeRanges();
      return parseHomeSheet(data).chapters;
    },
    async fetchSummary() {
      const data = await fetchHomeRanges();
      return parseHomeSheet(data).summary;
    },
  };
}
