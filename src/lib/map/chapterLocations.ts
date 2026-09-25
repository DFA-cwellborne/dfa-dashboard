import { slugifyName } from "@/lib/types/schema";

/**
 * Campus coordinates for chapters, keyed by slugifyName(chapter name).
 *
 * The Google Sheet only tracks each chapter's state, not its campus address,
 * so there's no source data to place a dot precisely — this list fills that
 * gap by hand. When a new chapter charters, add its city/lat/lon here and
 * its dot moves off the state's center automatically at the next sync; until
 * then (or for a name that doesn't match one below) it falls back to fanning
 * out around the state's center, same as before. Coordinates are city/campus
 * level, not an exact street address — plenty precise for a ~16px map dot.
 */
export interface ChapterLocation {
  city: string;
  lat: number;
  lon: number;
}

export const CHAPTER_LOCATIONS: Record<string, ChapterLocation> = {
  [slugifyName("Butler University")]: { city: "Indianapolis, IN", lat: 39.8403, lon: -86.1699 },
  [slugifyName("University of Michigan")]: { city: "Ann Arbor, MI", lat: 42.278, lon: -83.7382 },
  [slugifyName("Minnetonka High School")]: { city: "Minnetonka, MN", lat: 44.9027, lon: -93.4855 },
  [slugifyName("Crossroads College Prep")]: { city: "St. Louis, MO", lat: 38.6486, lon: -90.2814 },
  [slugifyName("University of Oklahoma")]: { city: "Norman, OK", lat: 35.206, lon: -97.4395 },
  [slugifyName("Abingdon High School")]: { city: "Abingdon, VA", lat: 36.7101, lon: -81.9762 },
  [slugifyName("Western Albemarle High School")]: { city: "Crozet, VA", lat: 38.0709, lon: -78.7005 },
  [slugifyName("North Carolina State University")]: { city: "Raleigh, NC", lat: 35.7847, lon: -78.6821 },
  [slugifyName("Westlake High School")]: { city: "Austin, TX", lat: 30.2853, lon: -97.8213 },
};

export function getChapterLocation(name: string): ChapterLocation | null {
  return CHAPTER_LOCATIONS[slugifyName(name)] ?? null;
}
