"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { isSupabaseConfigured } from "@/config/publicEnv";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { SyncLogRow } from "@/lib/types/database";
import { RelativeTime } from "./RelativeTime";

export interface SyncStatusIndicatorProps {
  initialLatest: SyncLogRow | null;
}

// Status dot: green = last sync across all sources succeeded; red = most
// recent sync attempt failed. Always paired with a text label — status
// color is never the only signal, per accessibility guidance for status hues.
export function SyncStatusIndicator({ initialLatest }: SyncStatusIndicatorProps) {
  const [latest, setLatest] = useState<SyncLogRow | null>(initialLatest);

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
          setLatest((current) => {
            if (!current) return row;
            return new Date(row.created_at) > new Date(current.created_at) ? row : current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const ok = latest?.success ?? null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3 py-1.5 text-xs font-medium text-navy/70">
      <span
        className={clsx(
          "h-2.5 w-2.5 rounded-full",
          ok === true && "bg-[#0ca30c]",
          ok === false && "bg-red",
          ok === null && "bg-navy/20"
        )}
      />
      {ok === null && "No sync yet"}
      {ok === true && latest && (
        <span>
          Synced <RelativeTime date={latest.finished_at} />
        </span>
      )}
      {ok === false && <span>Sync error — see Admin</span>}
    </div>
  );
}
