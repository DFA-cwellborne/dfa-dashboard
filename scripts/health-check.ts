// Live health check: is the deployed system actually working right now?
// Uses only the public anon key (the same access any visitor has) and plain
// HTTP, so it can run anywhere. Exits 1 if anything is FAIL; WARN doesn't fail.
//
//   npm run health
//
// SITE_URL overrides the deployed URL to check.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE_URL = (process.env.SITE_URL ?? "https://dfa-cwellborne.github.io/dfa-dashboard/").replace(/\/?$/, "/");

// Actions cron is every 20 min; GitHub can delay scheduled runs, so allow slack.
const MAX_SYNC_AGE_MIN = 60;
const SOURCES = ["google_sheets", "airtable"] as const;

type Level = "PASS" | "WARN" | "FAIL";
interface Result {
  level: Level;
  name: string;
  detail: string;
}
const results: Result[] = [];
const record = (level: Level, name: string, detail: string) => results.push({ level, name, detail });

async function rest(path: string, extraHeaders: Record<string, string> = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}`, ...extraHeaders },
    signal: AbortSignal.timeout(15_000),
  });
}

// What a public visitor can read must never contain credentials.
const SECRET_PATTERNS = [/[?&](?:key|api_key|apikey|token)=(?!\[redacted\])[^&\s]+/i, /AIza[0-9A-Za-z_-]{20,}/, /Bearer\s+(?!\[redacted\])[A-Za-z0-9._-]{8,}/i];

async function checkSupabase() {
  if (!SUPABASE_URL || !ANON_KEY) {
    record("FAIL", "Supabase configured", "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
    return;
  }

  try {
    const res = await rest("chapters?select=id", { Prefer: "count=exact", Range: "0-0" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get("content-range")?.split("/")[1]);
    record("PASS", "Supabase reachable (anon read)", "chapters table readable");
    record(total > 0 ? "PASS" : "FAIL", "Chapters present", `${total} chapters`);
  } catch (e) {
    record("FAIL", "Supabase reachable (anon read)", String(e));
    return;
  }

  try {
    const res = await rest("sheet_summary?id=eq.default&select=total_chapters,active_chapters,total_members");
    const rows = (await res.json()) as Record<string, number | null>[];
    record(rows.length ? "PASS" : "FAIL", "Sheet summary present", rows.length ? JSON.stringify(rows[0]) : "no summary row");
  } catch (e) {
    record("FAIL", "Sheet summary present", String(e));
  }

  // Privacy: everything below is readable by ANY visitor (the anon key is in the site's JS).
  // Read the tables exactly as a stranger could — every column — and look for personal data.
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
  const PHONE = /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;
  for (const table of ["chapters", "chapter_signups", "chapter_events"]) {
    try {
      const res = await rest(`${table}?select=*&limit=1000`);
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const hits = [EMAIL.test(text) && "email addresses", PHONE.test(text) && "phone numbers"].filter(Boolean);
      record(hits.length ? "FAIL" : "PASS", `No personal data publicly readable: ${table}`, hits.length ? `PUBLIC DATA CONTAINS ${hits.join(" + ")}` : "no emails/phones");
    } catch (e) {
      record("FAIL", `No personal data publicly readable: ${table}`, String(e));
    }
  }

  // Sync freshness + reliability, per source.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  try {
    const res = await rest(`sync_log?select=source,success,finished_at,errors&created_at=gte.${since}&order=created_at.desc&limit=1000`);
    const rows = (await res.json()) as { source: string; success: boolean; finished_at: string; errors: string[] }[];

    for (const source of SOURCES) {
      const mine = rows.filter((r) => r.source === source);
      if (!mine.length) {
        record("FAIL", `${source}: syncing`, "no sync runs logged in the last 24h");
        continue;
      }
      const ageMin = (Date.now() - new Date(mine[0].finished_at).getTime()) / 60_000;
      record(ageMin <= MAX_SYNC_AGE_MIN ? "PASS" : "FAIL", `${source}: sync is fresh`, `last run ${Math.round(ageMin)} min ago (limit ${MAX_SYNC_AGE_MIN})`);
      record(mine[0].success ? "PASS" : "WARN", `${source}: last run succeeded`, mine[0].success ? "ok" : (mine[0].errors[0] ?? "failed").slice(0, 140));

      const failed = mine.filter((r) => !r.success).length;
      const rate = failed / mine.length;
      record(rate > 0.5 ? "FAIL" : rate > 0.15 ? "WARN" : "PASS", `${source}: 24h reliability`, `${failed}/${mine.length} runs failed (${Math.round(rate * 100)}%)`);
    }

    const leaky = rows.filter((r) => r.errors.some((e) => SECRET_PATTERNS.some((p) => p.test(e))));
    record(leaky.length ? "FAIL" : "PASS", "No credentials in public sync_log", leaky.length ? `${leaky.length} row(s) contain what looks like a credential` : `${rows.length} rows checked`);
  } catch (e) {
    record("FAIL", "Sync history readable", String(e));
  }
}

async function checkSite() {
  try {
    const res = await fetch(SITE_URL, { signal: AbortSignal.timeout(15_000) });
    const html = await res.text();
    record(res.ok ? "PASS" : "FAIL", "Site responds", `${SITE_URL} → HTTP ${res.status}`);
    record(html.includes("DFA Metrics Dashboard") ? "PASS" : "FAIL", "Site serves the dashboard", html.includes("DFA Metrics Dashboard") ? "title found" : "expected title missing");

    for (const asset of ["dfa-logo.svg"]) {
      const a = await fetch(SITE_URL + asset, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
      record(a.ok ? "PASS" : "FAIL", `Asset ${asset}`, `HTTP ${a.status}`);
    }

    // Use the URL exactly as the page references it (it includes the /dfa-dashboard basePath).
    const chunk = html.match(/(?:src|href)="([^"]*\/_next\/static\/chunks\/[^"]+\.js)"/)?.[1];
    if (chunk) {
      const c = await fetch(new URL(chunk, SITE_URL).href, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
      record(c.ok ? "PASS" : "FAIL", "JS bundle loads", `HTTP ${c.status}`);
    } else {
      record("FAIL", "JS bundle loads", "no script chunk referenced in HTML");
    }
  } catch (e) {
    record("FAIL", "Site responds", String(e));
  }
}

async function main() {
  await checkSupabase();
  await checkSite();

  const icon: Record<Level, string> = { PASS: "✔", WARN: "⚠", FAIL: "✘" };
  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) console.log(`${icon[r.level]} ${r.level}  ${r.name.padEnd(width)}  ${r.detail}`);

  const count = (l: Level) => results.filter((r) => r.level === l).length;
  console.log(`\n${count("PASS")} passed, ${count("WARN")} warnings, ${count("FAIL")} failed`);
  process.exit(count("FAIL") ? 1 : 0);
}

main();
