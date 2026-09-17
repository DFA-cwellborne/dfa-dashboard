// Centralized, typed access to environment variables. Nothing here is
// hardcoded — every credential comes from the environment (see .env.local.example).
//
// IMPORTANT: NEXT_PUBLIC_* vars must be accessed as a literal
// `process.env.NEXT_PUBLIC_X` (not a dynamic `process.env[name]`) so
// Next.js's bundler can statically inline them into the browser bundle.
// Server-only secrets can use the dynamic `optional()` helper safely, since
// that code only ever runs in Node.

function optional(name: string): string | undefined {
  return process.env[name];
}

export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
  },
  googleSheets: {
    spreadsheetId: optional("GOOGLE_SHEETS_SPREADSHEET_ID"),
    sheetName: optional("GOOGLE_SHEETS_SHEET_NAME") ?? "Home",
    serviceAccountEmail: optional("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    // Store the private key with literal \n escapes in the env var; we unescape here.
    serviceAccountPrivateKey: optional("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")?.replace(
      /\\n/g,
      "\n"
    ),
    // Simpler alternative to a service account: works if the sheet is set to
    // "Anyone with the link can view".
    apiKey: optional("GOOGLE_SHEETS_API_KEY"),
  },
  airtable: {
    apiKey: optional("AIRTABLE_API_KEY"),
    signupsBaseId: optional("AIRTABLE_SIGNUPS_BASE_ID"),
    signupsTable: optional("AIRTABLE_SIGNUPS_TABLE") ?? "Table 1",
    eventsBaseId: optional("AIRTABLE_EVENTS_BASE_ID"),
    eventsTable: optional("AIRTABLE_EVENTS_TABLE") ?? "Events",
  },
  breakthru: {
    apiBaseUrl: optional("BREAKTHRU_API_BASE_URL"),
    apiKey: optional("BREAKTHRU_API_KEY"),
  },
  sync: {
    // Minutes between scheduled syncs. Configurable per the "every 15-30 min" requirement.
    intervalMinutes: Number(optional("SYNC_INTERVAL_MINUTES") ?? "20"),
    cronSecret: optional("SYNC_CRON_SECRET"),
    useMockData: optional("USE_MOCK_DATA") === "true",
  },
};

export function isSupabaseConfigured() {
  return Boolean(env.supabase.url && env.supabase.anonKey);
}
