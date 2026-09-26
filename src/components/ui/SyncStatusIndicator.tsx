"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { isSupabaseConfigured } from "@/config/publicEnv";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { SyncLogRow } from "@/lib/types/database";
import { RelativeTime } from "./RelativeTime";
import { InfoTooltip } from "./InfoTooltip";

export interface SyncStatusIndicatorProps {
  initialLatest: SyncLogRow | null;
}

// Status dot: green = last sync across all sources succeeded; red = most
// recent sync attempt failed. Always paired with a text label — status
// color is never the only signal, per accessibility guidance for status hues.
export function SyncStatusIndicator({ initialLatest }: SyncStatusIndicatorProps) {
  // Tracked separately from `initialLatest` — this component mounts once
  // with initialLatest={null} while Overview.tsx is still loading, then
  // re-renders with the real value once it arrives, so the prop can't be
  // baked into useState's initial value (that would only ever see the first,
  // null, render). liveLatest holds anything newer that arrives afterward
  // via the realtime subscription.
  const [liveLatest, setLiveLatest] = useState<SyncLogRow | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel("sync_log_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sync_log" },
        (payload) => {
          const row = payload.new as SyncLogRow;
          setLiveLatest((current) => {
            const currentBest = current ?? initialLatest;
            if (!currentBest) return row;
            return new Date(row.created_at) > new Date(currentBest.created_at) ? row : current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialLatest]);

  const latest = liveLatest ?? initialLatest;
  const ok = latest?.success ?? null;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-navy/10 bg-white px-3 py-1.5 text-xs font-medium text-navy/70">
      <span
        className={clsx(
          "h-2.5 w-2.5 rounded-full",
          ok === true && "bg-[#0ca30c]",
          ok === false && "bg-red",
          ok === null && "bg-navy/20"
        )}
      />
      {ok === null && "No data synced yet"}
      {ok === true && latest && (
        <span>
          Data synced <RelativeTime date={latest.finished_at} />
        </span>
      )}
      {ok === false && <span>Sync error — see Admin</span>}
      <InfoTooltip text="Chapters, members, and events sync in automatically from Google Sheets and Airtable roughly every 20 minutes. This is how old that synced data is — it's separate from the page's own refresh, which just re-reads whatever was synced most recently." />
    </div>
  );
}
