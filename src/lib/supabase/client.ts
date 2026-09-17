"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/config/env";
import type { Database } from "@/lib/types/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client — anon key only, used for reads and realtime subscriptions. */
export function getBrowserSupabase() {
  if (!env.supabase.url || !env.supabase.anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(env.supabase.url, env.supabase.anonKey);
  }
  return browserClient;
}
