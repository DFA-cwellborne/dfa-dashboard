// Client-safe env access — literal NEXT_PUBLIC_* member expressions ONLY.
//
// This is a separate module from env.ts on purpose: env.ts's optional()
// helper does a dynamic process.env[name] lookup for server secrets, and
// once any file that touches that helper is reachable from a client
// component, Next's bundler inlines the *entire* loaded .env value for that
// key into the client JS — not just the NEXT_PUBLIC_ ones. (Confirmed by
// grepping the exported bundle: the Supabase service-role key leaked in
// exactly this way before this file existed.) Client code — anything
// imported by src/components/dashboard/Overview.tsx or other "use client"
// files — must only ever import from here, never from "@/config/env" or
// "@/lib/supabase/server".
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  // SHA-256 hex digest of the staff password — see PasswordGate.tsx. Not
  // real access control (see that file's doc comment): the Supabase anon
  // key ships in this same bundle either way, so this only keeps casual
  // visitors from viewing the page, not from querying Supabase directly.
  dashboardPasswordHash: process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD_HASH,
};

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
