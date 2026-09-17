import { env } from "@/config/env";

// Real Breakthru "Data Platform API" client, per their docs
// (joinbreakthru.notion.site/platform-api-documentation). This only exposes
// **people** (individual members with custom fields) — there is no
// chapters/groups endpoint, so this does not implement the SourceAdapter
// interface used by the Sheets/Airtable sync (see breakthruAdapter.ts).

export interface BreakthruPerson {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  created: string;
  [customField: string]: unknown;
}

export interface BreakthruListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BreakthruPerson[];
}

function requireConfig() {
  const { apiBaseUrl, apiKey } = env.breakthru;
  if (!apiBaseUrl || !apiKey) {
    throw new Error("Breakthru is not configured — set BREAKTHRU_API_BASE_URL and BREAKTHRU_API_KEY.");
  }
  return { apiBaseUrl, apiKey };
}

async function breakthruFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiBaseUrl, apiKey } = requireConfig();
  const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Breakthru API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** GET /api/integration/people/ — paginated; pass limit/offset/created_on_or_after. */
export async function listPeople(params?: {
  limit?: number;
  offset?: number;
  createdOnOrAfter?: string; // YYYY-MM-DD
}): Promise<BreakthruListResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.createdOnOrAfter) search.set("created_on_or_after", params.createdOnOrAfter);
  const qs = search.toString();
  return breakthruFetch<BreakthruListResponse>(`/api/integration/people/${qs ? `?${qs}` : ""}`);
}

/** Fetches every page — fine for a periodic sync job, not for request-time use. */
export async function listAllPeople(): Promise<BreakthruPerson[]> {
  const all: BreakthruPerson[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await listPeople({ limit, offset });
    all.push(...page.results);
    if (!page.next) break;
    offset += limit;
  }
  return all;
}

/** GET /api/integration/people/{id}/ */
export async function getPerson(id: number): Promise<BreakthruPerson> {
  return breakthruFetch<BreakthruPerson>(`/api/integration/people/${id}/`);
}

/** PATCH /api/integration/people/{id}/update/ — all fields optional. */
export async function updatePerson(
  id: number,
  fields: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone_number?: string;
    custom_fields?: Record<string, string>;
  }
): Promise<BreakthruPerson> {
  return breakthruFetch<BreakthruPerson>(`/api/integration/people/${id}/update/`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

/** POST /api/integration/people/{id}/points/create/ */
export async function createPointsTransaction(
  id: number,
  points: number,
  incentiveName: string
): Promise<void> {
  await breakthruFetch(`/api/integration/people/${id}/points/create/`, {
    method: "POST",
    body: JSON.stringify({ points, Incentive_name: incentiveName }),
  });
}
