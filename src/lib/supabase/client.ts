"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/config/publicEnv";
import type { Database } from "@/lib/types/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client — anon key only, used for reads and realtime subscriptions. */
export function getBrowserSupabase() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return browserClient;
}
