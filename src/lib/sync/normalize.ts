import {
  EVENT_FIELD_ALIASES,
  EVENT_TYPE_VALUE_MAP,
  MASTER_LIST_SCHOOL_TYPE_MAP,
  MASTER_LIST_STATUS_MAP,
  SCHOOL_TYPE_VALUE_MAP,
  SIGNUP_FIELD_ALIASES,
  SIGNUP_INTENT_FIELDS,
  getField,
} from "@/config/sheetMapping";
import { slugifyName } from "@/lib/types/schema";
import type { Chapter, ChapterEvent, ChapterSignup, DataSource } from "@/lib/types/schema";

function toStringOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toIsoDateOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapEnum<T extends string>(v: unknown, map: Record<string, T>): T | null {
  const s = toStringOrNull(v);
  if (!s) return null;
  return map[s.toLowerCase()] ?? null;
}

/**
 * Turns one "Chapter Master List" row (School/Region, C/H, State, ...,
 * RSO Status, Charter Status, Status, Member Count, ...) into a Chapter.
 * Column order matches CHAPTER_MASTER_LIST_LAYOUT.dataRange in
 * src/config/sheetMapping.ts — update both together if columns move.
 */
export function chapterFromMasterListRow(row: unknown[]): Chapter | null {
  const cleanName = toStringOrNull(row[0]);
  if (!cleanName || cleanName === "[SCHOOL]") return null;
  return {
    externalId: slugifyName(cleanName),
    name: cleanName,
    schoolType: mapEnum(row[1], MASTER_LIST_SCHOOL_TYPE_MAP),
    status: mapEnum(row[10], MASTER_LIST_STATUS_MAP),
    state: toStringOrNull(row[2]),
    locale: null,
    memberCount: toNumberOrNull(row[11]),
    signupDate: null,
    charterDate: null,
    term: null,
    source: "google_sheets",
    raw: { row },
  };
}

/**
 * The intake base is a general "get involved" form (career interest, email
 * updates, community involvement, etc.), not a dedicated chapter-signup
 * form — so a submission only counts as a chapter signup if one of the
 * "how would you like to get involved" fields includes a chapter option.
 */
function wantsToStartOrJoinChapter(row: Record<string, unknown>): boolean {
  for (const field of SIGNUP_INTENT_FIELDS) {
    const value = row[field];
    const options = Array.isArray(value) ? value : [value];
    if (options.some((v) => typeof v === "string" && v.toLowerCase().includes("chapter"))) {
      return true;
    }
  }
  return false;
}

export function normalizeSignupRow(
  row: Record<string, unknown>,
  source: DataSource
): ChapterSignup | null {
  const externalId = toStringOrNull(getField(row, SIGNUP_FIELD_ALIASES.externalId));
  if (!externalId || !wantsToStartOrJoinChapter(row)) return null;

  return {
    externalId,
    chapterName: toStringOrNull(getField(row, SIGNUP_FIELD_ALIASES.chapterName)),
    schoolType: mapEnum(getField(row, SIGNUP_FIELD_ALIASES.schoolType), SCHOOL_TYPE_VALUE_MAP),
    submittedAt: toIsoDateOrNull(getField(row, SIGNUP_FIELD_ALIASES.submittedAt)),
    status: toStringOrNull(getField(row, SIGNUP_FIELD_ALIASES.status)),
    source,
    raw: row,
  };
}

export function normalizeEventRow(
  row: Record<string, unknown>,
  source: DataSource
): ChapterEvent | null {
  const externalId = toStringOrNull(getField(row, EVENT_FIELD_ALIASES.externalId));
  const chapterName = toStringOrNull(getField(row, EVENT_FIELD_ALIASES.chapterExternalId));
  if (!externalId || !chapterName) return null;

  return {
    externalId,
    // Slugified the same way as the roster's externalId, so casing/whitespace
    // differences in the free-text "which school" field still match up.
    chapterExternalId: slugifyName(chapterName),
    eventType:
      mapEnum(getField(row, EVENT_FIELD_ALIASES.eventType), EVENT_TYPE_VALUE_MAP) ?? "other",
    eventDate: toIsoDateOrNull(getField(row, EVENT_FIELD_ALIASES.eventDate)),
    attendeeCount: toNumberOrNull(getField(row, EVENT_FIELD_ALIASES.attendeeCount)),
    volunteerHours: toNumberOrNull(getField(row, EVENT_FIELD_ALIASES.volunteerHours)),
    source,
    raw: row,
  };
}
