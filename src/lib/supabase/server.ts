import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import type { Database } from "@/lib/types/database";

/**
 * Server-side read client. Uses the anon key — safe defaults for RPCs from
 * server components/route handlers that only ever read.
 */
export function getServerSupabase() {
  if (!env.supabase.url || !env.supabase.anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createClient<Database>(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false },
  });
}

/**
 * Service-role client — server-only, used exclusively by the sync
 * orchestrator to upsert data. Never import this from client components.
 */
export function getServiceRoleSupabase() {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error(
      "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient<Database>(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  });
}
