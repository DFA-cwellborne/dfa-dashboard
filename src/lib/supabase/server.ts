import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import type { Database } from "@/lib/types/database";

/**
 * Service-role client — Node-only, used exclusively by the sync orchestrator
 * (invoked from scripts/run-sync.ts via the GitHub Actions cron) to upsert
 * data. Never import this file — or anything that imports it — from a
 * client component; see src/config/publicEnv.ts for why.
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
