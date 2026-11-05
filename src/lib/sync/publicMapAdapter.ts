import { parseCsvObjects } from "./csv";
import { publicMapChapterFromCsvRow } from "./normalize";
import type { PublicMapChapter } from "@/lib/types/schema";

// The same published-to-web CSV that already drives the live map at
// dreamforamerica.org/chapters/ — a Google Sheet "Public map" tab exported
// as CSV. No credentials needed; it's already public.
export const PUBLIC_MAP_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1rTM3xgJlHOmeg_4wCXloc1JB6Icn_RYYsioh9qmHbp0/export?format=csv&gid=1745613913";

export async function fetchPublicMapChapters(url: string = PUBLIC_MAP_CSV_URL): Promise<PublicMapChapter[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`fetching public map CSV failed: HTTP ${res.status}`);
  const text = await res.text();
  return parseCsvObjects(text)
    .map(publicMapChapterFromCsvRow)
    .filter((c): c is PublicMapChapter => c !== null);
}
